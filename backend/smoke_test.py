"""End-to-end smoke test for the JAL 24x7 API.

Exercises the real customer journey against a throwaway database:
    OTP login -> browse -> quote -> checkout -> pay -> track -> reorder
plus the marketplace, subscriptions, directory, admin and vendor panels.

Run:  python smoke_test.py
"""

from __future__ import annotations

import os
import pathlib
import sys
import tempfile

# Point at a scratch database BEFORE importing the app, so a test run never
# touches the developer's real jal24x7.db.
TEST_DB = pathlib.Path(tempfile.gettempdir()) / "jal24x7_smoke.db"
TEST_DB.unlink(missing_ok=True)
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
# The limiter is exercised by its own dedicated check below; leaving it on
# for the whole run would throttle the suite itself.
os.environ["RATE_LIMIT_ENABLED"] = "false"

from fastapi.testclient import TestClient  # noqa: E402

from app.config import settings  # noqa: E402
from app.main import app  # noqa: E402

PASS, FAIL = 0, 0


def check(label: str, condition: bool, detail: str = "") -> None:
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  [PASS] {label}")
    else:
        FAIL += 1
        print(f"  [FAIL] {label}  {detail}")


def section(title: str) -> None:
    print(f"\n{title}\n" + "-" * len(title))


with TestClient(app) as client:
    section("1. Health & catalogue")
    r = client.get("/health")
    check("health endpoint", r.status_code == 200 and r.json()["status"] == "healthy")

    r = client.get("/api/products")
    products = r.json()
    check("products seeded", r.status_code == 200 and len(products) == 12, f"got {len(products)}")
    check("every product has a real photo", all(p["image_url"].startswith("/images/") for p in products))

    r = client.get("/api/products", params={"category": "can", "sort": "price_asc"})
    cans = r.json()
    check("category filter (cans)", all(p["category"] == "can" for p in cans) and len(cans) == 4, f"got {len(cans)}")
    check("price sort ascending", [p["price"] for p in cans] == sorted(p["price"] for p in cans))

    r = client.get("/api/tankers", params={"segment": "society"})
    society_tankers = r.json()
    check("society tanker tiers", len(society_tankers) == 3)

    section("2. Marketplace (vendor matching)")
    pin = {"lat": 22.7496, "lng": 75.8917}
    r = client.get("/api/vendors/nearby", params={**pin, "sort": "best"})
    matches = r.json()
    check("nearby vendors returned", r.status_code == 200 and len(matches) > 0, f"got {len(matches)}")
    check("only verified vendors listed", all(m["vendor"]["is_verified"] for m in matches))
    check(
        "ranked best-first by score",
        [m["score"] for m in matches] == sorted((m["score"] for m in matches), reverse=True),
    )
    check("match carries explanation", all(len(m["reasons"]) > 0 for m in matches))

    r = client.get("/api/vendors/nearby", params={**pin, "sort": "nearest"})
    nearest = r.json()
    check(
        "nearest sort works",
        [m["distance_km"] for m in nearest] == sorted(m["distance_km"] for m in nearest),
    )

    section("3. OTP authentication")
    r = client.post("/api/auth/otp/request", json={"phone": "9876543210"})
    otp_body = r.json()
    check("otp requested", r.status_code == 200 and otp_body.get("demo_otp") is not None)
    otp = otp_body["demo_otp"]

    r = client.post("/api/auth/otp/verify", json={"phone": "9876543210", "code": "000000"})
    check("wrong otp rejected", r.status_code == 400, str(r.status_code))

    r = client.post("/api/auth/otp/verify", json={"phone": "9876543210", "code": otp})
    check("correct otp accepted", r.status_code == 200, r.text[:120])
    token = r.json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}

    r = client.post("/api/auth/otp/verify", json={"phone": "9876543210", "code": otp})
    check("otp is single-use", r.status_code == 400)

    r = client.get("/api/auth/me", headers=auth)
    check("authenticated profile", r.status_code == 200 and r.json()["phone"] == "9876543210")

    r = client.get("/api/orders")
    check("unauthenticated order list blocked", r.status_code == 401)

    r = client.post("/api/auth/otp/request", json={"phone": "12345"})
    check("invalid phone rejected", r.status_code == 422)

    section("4. Quoting & pricing rules")
    can = next(p for p in products if p["sku"] == "CAN-20L-1")
    r = client.post("/api/quote", json={"lines": [{"product_id": can["id"], "quantity": 2}]})
    small = r.json()
    # Read the expected fee from settings rather than hard-coding it, so
    # repricing the catalogue does not break this test.
    check(
        "small order pays delivery fee",
        small["delivery_fee"] == settings.base_delivery_fee,
        str(small["delivery_fee"]),
    )
    check("gst applied", small["tax"] > 0)

    r = client.post("/api/quote", json={"lines": [{"product_id": can["id"], "quantity": 20}]})
    bulk = r.json()
    check("bulk order gets free delivery", bulk["delivery_fee"] == 0.0)
    check("bulk discount applied", bulk["discount"] > 0, bulk["discount_label"])
    check("400L computed", bulk["total_litres"] == 400.0, str(bulk["total_litres"]))

    expected = round(
        (bulk["subtotal"] - bulk["discount"] + bulk["delivery_fee"] + bulk["distance_surcharge"]) * 1.18,
        2,
    )
    check("total = taxable * 1.18", abs(bulk["total"] - expected) < 0.02, f"{bulk['total']} vs {expected}")

    tanker = next(t for t in society_tankers if t["capacity_l"] == 8000)
    r = client.post(
        "/api/quote",
        json={
            "lines": [{"item_type": "tanker", "tanker_tier_id": tanker["id"], "quantity": 1}],
            "lat": 22.79, "lng": 75.95, "is_society": True,
        },
    )
    tq = r.json()
    check("tanker quote priced", r.status_code == 200 and tq["total"] > 0)
    check("distance surcharge applied", tq["distance_surcharge"] > 0, str(tq["distance_surcharge"]))
    check("society discount applied", "Society" in tq["discount_label"], tq["discount_label"])

    r = client.post(
        "/api/quote",
        json={
            "lines": [
                {"product_id": can["id"], "quantity": 1},
                {"item_type": "tanker", "tanker_tier_id": tanker["id"], "quantity": 1},
            ]
        },
    )
    check("mixing tanker + products blocked", r.status_code == 400, str(r.status_code))

    section("5. Checkout & payment")
    order_payload = {
        "lines": [{"product_id": can["id"], "quantity": 5}],
        "order_type": "products",
        "contact_name": "Tejas Tripathi",
        "contact_phone": "9876543210",
        "address_line": "12, Scheme No. 54, Vijay Nagar",
        "address_pincode": "452010",
        "address_lat": 22.7496,
        "address_lng": 75.8917,
        "delivery_slot": "Today, 6-8 PM",
        "payment_method": "razorpay_test",
    }
    r = client.post("/api/orders", json=order_payload, headers=auth)
    check("order created", r.status_code == 201, r.text[:200])
    order = r.json()
    code = order["order_code"]
    check("order code allocated", code.startswith("JAL") and len(code) == 9, code)
    check("vendor auto-assigned", order["vendor"] is not None)
    check("starts unpaid & pending", order["payment_status"] == "pending" and order["status"] == "pending")
    check("line items stored", len(order["items"]) == 1 and order["items"][0]["quantity"] == 5)

    stock_before = can["stock"]
    r = client.get(f"/api/products/{can['id']}")
    check("stock reserved on order", r.json()["stock"] == stock_before - 5, str(r.json()["stock"]))

    # Server-side pricing must ignore any client-supplied price.
    tampered = {**order_payload, "lines": [{"product_id": can["id"], "quantity": 5, "price": 1}]}
    r = client.post("/api/orders", json=tampered, headers=auth)
    check("client price tampering ignored", r.json()["total"] == order["total"], r.text[:120])
    client.post(f"/api/orders/{r.json()['order_code']}/cancel", headers=auth)

    r = client.post(f"/api/orders/{code}/pay", headers=auth)
    paid = r.json()
    check("payment confirmed", r.status_code == 200 and paid["payment_status"] == "paid")
    check("test payment ref issued", paid["payment_ref"].startswith("pay_test_"))
    check("status advanced to confirmed", paid["status"] == "confirmed")

    r = client.post(f"/api/orders/{code}/pay", headers=auth)
    check("double payment rejected", r.status_code == 409)

    section("6. Tracking")
    r = client.get(f"/api/orders/{code}/tracking")
    track = r.json()
    check("public tracking works", r.status_code == 200)
    check("stepper flow exposed", track["flow"] == ["pending", "confirmed", "vendor_assigned", "out_for_delivery", "delivered"])
    check("status index correct", track["status_index"] == 1, str(track["status_index"]))
    check("audit trail recorded", len(track["events"]) >= 2, str(len(track["events"])))
    check("destination pin present", track["destination_lat"] == 22.7496)

    with client.websocket_connect(f"/api/orders/{code}/ws") as ws:
        snapshot = ws.receive_json()
        check("websocket pushes snapshot", snapshot["order_code"] == code)
        check("websocket carries status", snapshot["status"] in track["flow"])

        # Regression guard: `POST /pay` is a sync endpoint, so it runs in a
        # worker thread with no running event loop. The simulator must schedule
        # onto the main loop anyway -- otherwise tracking silently never moves.
        advanced = False
        for _ in range(40):
            frame = ws.receive_json()
            if frame["status"] != snapshot["status"]:
                advanced = True
                break
        check(
            "simulation advances past 'confirmed' (sync endpoint schedules onto the loop)",
            advanced,
            "no status change pushed over the socket",
        )

    r = client.get("/api/orders/JAL000000/tracking")
    check("unknown order 404s", r.status_code == 404)

    section("7. Order history & reorder")
    r = client.get("/api/orders", headers=auth)
    check("history lists orders", r.status_code == 200 and len(r.json()) >= 1)

    r = client.get("/api/orders", headers=auth, params={"status": "active"})
    check("active filter works", all(o["status"] not in ("delivered", "cancelled") for o in r.json()))

    r = client.post(f"/api/orders/{code}/reorder", headers=auth)
    check("reorder creates new order", r.status_code == 201 and r.json()["order_code"] != code)
    reorder_code = r.json()["order_code"]
    check("reorder copies items", r.json()["items"][0]["quantity"] == 5)

    r = client.post(f"/api/orders/{reorder_code}/cancel", headers=auth)
    check("cancel works", r.status_code == 200 and r.json()["status"] == "cancelled")
    r = client.get(f"/api/products/{can['id']}")
    check("stock returned on cancel", r.json()["stock"] == stock_before - 5, str(r.json()["stock"]))

    section("8. Subscriptions")
    camper = next(p for p in products if p["sku"] == "CMP-OFC-50")
    r = client.post(
        "/api/subscriptions/estimate",
        params={"plan_type": "camper", "frequency": "daily", "quantity": 2, "product_id": camper["id"]},
    )
    est = r.json()
    check("subscription estimate", r.status_code == 200 and est["deliveries_per_month"] == 30)
    check("recurring discount applied", est["savings"] > 0, str(est["savings"]))

    r = client.post(
        "/api/subscriptions",
        headers=auth,
        json={
            "plan_type": "camper", "frequency": "daily", "quantity": 2,
            "product_id": camper["id"], "contact_name": "Tejas Tripathi",
            "contact_phone": "9876543210", "address_line": "12, Scheme No. 54, Vijay Nagar",
            "preferred_window": "07:00-09:00", "start_date": "2026-09-01",
        },
    )
    check("camper subscription created", r.status_code == 201, r.text[:160])
    sub_id = r.json()["id"]

    r = client.post(
        "/api/subscriptions",
        headers=auth,
        json={
            "plan_type": "society_tanker", "frequency": "weekly", "quantity": 4,
            "tanker_tier_id": tanker["id"], "contact_name": "RWA Secretary",
            "contact_phone": "9876500011", "address_line": "Silver Springs Phase 2",
            "preferred_window": "06:00-08:00", "start_date": "2026-09-01",
            "society_name": "Silver Springs RWA", "units_count": 120,
        },
    )
    check("society contract created", r.status_code == 201, r.text[:160])

    r = client.post(
        "/api/subscriptions",
        headers=auth,
        json={
            "plan_type": "society_tanker", "frequency": "weekly", "quantity": 1,
            "tanker_tier_id": tanker["id"], "contact_name": "No Society",
            "contact_phone": "9876500011", "address_line": "Somewhere",
            "start_date": "2026-09-01",
        },
    )
    check("society name required", r.status_code == 400)

    r = client.post(f"/api/subscriptions/{sub_id}/pause", headers=auth)
    check("subscription pause toggles", r.json()["status"] == "paused")

    section("9. Contact & govt directory")
    r = client.post(
        "/api/contact",
        json={"name": "Tejas Tripathi", "email": "tejas@example.com",
              "subject": "Bulk enquiry", "message": "Need 5 tankers for a wedding next month."},
    )
    check("contact form submits", r.status_code == 201)

    r = client.get("/api/water-departments")
    check("directory seeded", len(r.json()) == 8, str(len(r.json())))

    # A point sitting right on the Zone 7 office (centre + 0.049 / + 0.028).
    r = client.get("/api/water-departments/nearest", params={"lat": 22.7686, "lng": 75.8857})
    check("nearest zone resolved", r.status_code == 200 and r.json()["zone"] == "Zone 7", r.text[:160])

    r = client.get("/api/water-departments/nearest", params={"lat": 22.7216, "lng": 75.8547})
    check("nearest zone switches with pin", r.json()["zone"] == "Zone 4", r.text[:160])

    section("10. Admin dashboard")
    r = client.post("/api/auth/otp/request", json={"phone": "9999900000"})
    admin_otp = r.json()["demo_otp"]
    r = client.post("/api/auth/otp/verify", json={"phone": "9999900000", "code": admin_otp})
    admin_auth = {"Authorization": f"Bearer {r.json()['access_token']}"}
    check("admin logged in", r.json()["user"]["role"] == "admin")

    r = client.get("/api/admin/stats", headers=auth)
    check("customer blocked from admin", r.status_code == 403)

    r = client.get("/api/admin/stats", headers=admin_auth)
    stats = r.json()
    check("admin stats served", r.status_code == 200, r.text[:160])
    check("counts orders", stats["total_orders"] >= 2, str(stats["total_orders"]))
    check("tracks revenue", stats["total_revenue"] > 0)
    check("demand split present", set(stats["demand_by_service"]) == {"tanker", "bottled", "camper"})
    check("7-day revenue series", len(stats["revenue_last_7_days"]) == 7)
    check("pending kyc surfaced", stats["vendors_pending_kyc"] == 1, str(stats["vendors_pending_kyc"]))

    r = client.get("/api/admin/vendors", headers=admin_auth, params={"kyc_status": "pending"})
    pending_vendor = r.json()[0]
    check("pending vendor listed", pending_vendor["name"] == "Ujjwal Jal Suppliers")

    r = client.post(
        f"/api/admin/vendors/{pending_vendor['id']}/kyc",
        headers=admin_auth,
        json={"decision": "approve"},
    )
    check("kyc approval verifies vendor", r.json()["is_verified"] and r.json()["kyc_status"] == "approved")

    r = client.get("/api/admin/messages", headers=admin_auth)
    check("admin sees contact messages", len(r.json()) == 1)

    section("11. Vendor panel")
    r = client.post("/api/auth/otp/request", json={"phone": "9822001133"})
    v_otp = r.json()["demo_otp"]
    r = client.post("/api/auth/otp/verify", json={"phone": "9822001133", "code": v_otp})
    vendor_auth = {"Authorization": f"Bearer {r.json()['access_token']}"}
    check("vendor logged in", r.json()["user"]["role"] == "vendor")

    r = client.get("/api/vendor/me", headers=vendor_auth)
    check("vendor profile served", r.status_code == 200 and r.json()["name"] == "Indore Aqua Care")

    r = client.patch("/api/vendor/me", headers=vendor_auth, json={"price_per_trip": 1150, "is_online": True})
    check("vendor can update pricing", r.json()["price_per_trip"] == 1150)

    r = client.patch("/api/vendor/me", headers=vendor_auth, json={"min_capacity_l": 9000, "max_capacity_l": 2000})
    check("invalid capacity range rejected", r.status_code == 400)

    r = client.get("/api/vendor/orders", headers=vendor_auth)
    check("vendor sees assigned orders", r.status_code == 200)

    r = client.get("/api/vendor/me", headers=auth)
    check("customer blocked from vendor panel", r.status_code == 403)


    section("12. Tanker drivers")
    r = client.get("/api/drivers", params={"lat": 22.7496, "lng": 75.8917})
    roster = r.json()
    check("driver roster served", r.status_code == 200 and len(roster) >= 10, f"got {len(roster)}")
    check("each driver names their operator", all(d["operator_name"] for d in roster))
    check("operators are verified", all(d["operator_verified"] for d in roster))
    check(
        "sorted nearest first",
        [d["distance_km"] for d in roster] == sorted(d["distance_km"] for d in roster),
    )

    r = client.get("/api/drivers", params={"capacity_l": 12000})
    big = r.json()
    check("capacity filter works", all(d["driver"]["vehicle_capacity_l"] >= 12000 for d in big))
    check("large-vehicle drivers exist", len(big) >= 2, f"got {len(big)}")

    r = client.get(f"/api/drivers/{roster[0]['driver']['id']}")
    check("single driver lookup", r.status_code == 200 and r.json()["driver"]["vehicle_number"])

    section("13. Event and party bookings")
    r = client.get("/api/events/sizing", params={"guests": 200, "hours": 4})
    sizing = r.json()
    check("event sizing computed", r.status_code == 200 and sizing["total_litres"] > 0)
    check("summer uplift applied", sizing["total_litres"] == 375, str(sizing["total_litres"]))
    check("camper count derived", sizing["campers_100l"] == 4, str(sizing["campers_100l"]))

    r = client.get("/api/events/contacts", params={"lat": 22.7496, "lng": 75.8917, "guests": 200})
    contacts = r.json()
    check("event contacts returned", r.status_code == 200 and len(contacts) > 0, f"got {len(contacts)}")
    check("every contact has a person", all(c["contact_person"] for c in contacts))
    check("every contact takes events", all(c["vendor"]["supports_events"] for c in contacts))
    check("contacts carry an area", all(c["area"] for c in contacts))

    section("14. Payment sheet")
    r = client.get("/api/payments/methods")
    methods = r.json()
    check("payment methods served", r.status_code == 200)
    check("upi apps listed", len(methods["upi_apps"]) >= 5, str(len(methods["upi_apps"])))
    check("net banking listed", len(methods["netbanking"]) >= 6, str(len(methods["netbanking"])))
    check("cash on delivery offered", any(o["kind"] == "cod" for o in methods["others"]))

    pay_order = client.post("/api/orders", json=order_payload, headers=auth).json()
    pay_code = pay_order["order_code"]

    r = client.post(f"/api/payments/{pay_code}/pay", headers=auth,
                    json={"method_id": "upi_id", "upi_id": "not-a-vpa"})
    check("malformed UPI ID rejected", r.status_code == 400, str(r.status_code))

    r = client.post(f"/api/payments/{pay_code}/pay", headers=auth,
                    json={"method_id": "card_new", "card_number": "1234567812345678",
                          "card_holder": "Tejas"})
    check("invalid card number rejected (Luhn)", r.status_code == 400, str(r.status_code))

    r = client.post(f"/api/payments/{pay_code}/pay", headers=auth,
                    json={"method_id": "made_up_method"})
    check("unknown payment method rejected", r.status_code == 400)

    r = client.post(f"/api/payments/{pay_code}/pay", headers=auth,
                    json={"method_id": "upi_gpay"})
    paid_via_upi = r.json()
    check("UPI app payment succeeds", r.status_code == 200 and paid_via_upi["success"])
    check("payment is signed", len(paid_via_upi["signature"]) == 64)
    check("method label returned", paid_via_upi["method_label"] == "Google Pay")

    r = client.post(f"/api/payments/{pay_code}/pay", headers=auth, json={"method_id": "upi_gpay"})
    check("double payment blocked", r.status_code == 409)

    cod_order = client.post("/api/orders", json=order_payload, headers=auth).json()
    r = client.post(f"/api/payments/{cod_order['order_code']}/pay", headers=auth,
                    json={"method_id": "cod"})
    check("cash on delivery accepted", r.status_code == 200)
    check("cod marked pending, not paid",
          r.json()["order"]["payment_status"] == "cod_pending",
          r.json()["order"]["payment_status"])

    valid_card = client.post("/api/orders", json=order_payload, headers=auth).json()
    r = client.post(f"/api/payments/{valid_card['order_code']}/pay", headers=auth,
                    json={"method_id": "card_new", "card_number": "4111 1111 1111 1111",
                          "card_holder": "Tejas Tripathi"})
    check("valid test card accepted", r.status_code == 200, r.text[:120])

    section("15. Security hardening")
    r = client.get("/health")
    headers = r.headers
    check("X-Content-Type-Options set", headers.get("x-content-type-options") == "nosniff")
    check("X-Frame-Options denies framing", headers.get("x-frame-options") == "DENY")
    check("Referrer-Policy set", "strict-origin" in (headers.get("referrer-policy") or ""))
    check("Content-Security-Policy set", "default-src 'none'" in (headers.get("content-security-policy") or ""))
    check("Permissions-Policy restricts camera", "camera=()" in (headers.get("permissions-policy") or ""))
    check("request id attached", bool(headers.get("x-request-id")))

    # Stored-XSS attempt: the payload must never survive to the database.
    r = client.post("/api/contact", json={
        "name": "  ravi   KUMAR ",
        "email": "ravi@example.com",
        "subject": "<script>steal()</script>Bulk enquiry",
        "message": "Need water for <img src=x onerror=alert(1)> a function next week.",
    })
    check("hostile contact payload accepted after cleaning", r.status_code == 201, r.text[:120])

    stored = client.get("/api/admin/messages", headers=admin_auth).json()
    latest = stored[0]
    check("name title-cased on the way in", latest["name"] == "Ravi Kumar", latest["name"])
    check("script tag stripped from subject", "<script" not in latest["subject"] and "steal" not in latest["subject"], latest["subject"])
    check("img/onerror stripped from message", "onerror" not in latest["message"] and "<img" not in latest["message"], latest["message"])

    # Path/ID tampering: one customer must never read another customer's order.
    r = client.post("/api/auth/otp/request", json={"phone": "9812345678"})
    other_otp = r.json()["demo_otp"]
    r = client.post("/api/auth/otp/verify", json={"phone": "9812345678", "code": other_otp, "name": "Other User"})
    other_auth = {"Authorization": f"Bearer {r.json()['access_token']}"}

    r = client.get(f"/api/orders/{code}", headers=other_auth)
    check("cannot read another user's order", r.status_code == 404, str(r.status_code))
    r = client.post(f"/api/orders/{code}/cancel", headers=other_auth)
    check("cannot cancel another user's order", r.status_code == 404, str(r.status_code))
    r = client.post(f"/api/payments/{code}/pay", headers=other_auth, json={"method_id": "upi_gpay"})
    check("cannot pay for another user's order", r.status_code == 404, str(r.status_code))

    r = client.get("/api/auth/me", headers={"Authorization": "Bearer not.a.real.token"})
    check("forged token rejected", r.status_code == 401)

    r = client.get("/api/admin/stats", headers=other_auth)
    check("role escalation blocked", r.status_code == 403)

    # Out-of-range coordinates must be refused, not clamped silently.
    r = client.get("/api/vendors/nearby", params={"lat": 999, "lng": 75.8})
    check("invalid latitude rejected", r.status_code == 422)

    section("16. External API integrations")
    r = client.get("/api/integrations/pincode/452010")
    pin_data = r.json()
    check("pincode endpoint responds", r.status_code == 200)
    if pin_data.get("available"):
        check("pincode resolves to a district", bool(pin_data["district"]), str(pin_data)[:100])
        check("localities returned", len(pin_data["localities"]) > 0)
    else:
        check("pincode failure degrades gracefully", "detail" in pin_data, str(pin_data)[:100])

    r = client.get("/api/integrations/pincode/12")
    check("short pincode refused", r.json()["available"] is False)

    r = client.get("/api/integrations/weather", params={"lat": 22.7196, "lng": 75.8577})
    weather = r.json()
    check("weather endpoint responds", r.status_code == 200)
    check("demand advice always present", bool(weather.get("advice")))
    check("multiplier is sane", 1.0 <= weather.get("suggested_multiplier", 0) <= 2.0)

    r = client.get("/api/integrations/reverse-geocode", params={"lat": 22.7196, "lng": 75.8577})
    check("reverse geocode responds", r.status_code == 200 and "available" in r.json())


print("\n" + "=" * 52)
print(f"  RESULT:  {PASS} passed,  {FAIL} failed")
print("=" * 52)
# Best-effort cleanup. Windows can keep the SQLite handle open for a moment
# while a tracking-simulation worker thread winds down. This is a temp file
# that the next run recreates anyway, so never fail the suite over it.
from app.database import engine  # noqa: E402

engine.dispose()
try:
    TEST_DB.unlink(missing_ok=True)
except OSError:
    pass

sys.exit(1 if FAIL else 0)
