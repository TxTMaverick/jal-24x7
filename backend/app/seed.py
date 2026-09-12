"""Demo data.

Runs once on first boot (when the products table is empty). Everything is
Indore-centric to match the synopsis, with realistic Indian pricing so the
screens look credible in a demo.

Demo logins (all use OTP, and the code is shown on screen in demo mode):
    Customer : 9876543210
    Vendor   : 9822001133   (Indore Aqua Care)
    Admin    : 9999900000
"""

from __future__ import annotations

import logging

from sqlalchemy import select

from .database import SessionLocal
from .models import (
    KYC_APPROVED,
    KYC_PENDING,
    ROLE_ADMIN,
    ROLE_CUSTOMER,
    ROLE_VENDOR,
    Address,
    Product,
    TankerDriver,
    TankerTier,
    User,
    Vendor,
    WaterDepartment,
)

logger = logging.getLogger("jal24x7.seed")

# Rajwada, Indore. The reference point for all demo coordinates.
CITY_CENTRE = (22.7196, 75.8577)

IMG = "/images/products"


PRODUCTS = [
    # sku, name, category, capacity_l, pack, price, mrp, emoji, image, speed, eta, stock, description
    #
    # Listed prices are what the customer pays at the door: the supplier's rate
    # for the water plus the cost of bringing it. Benchmarked against what a
    # local supplier charges in an Indian city, so a 15L jar is about Rs 15 and
    # a 20L jar about Rs 20 at the shop; delivery adds Rs 5 and Rs 10, which is
    # what pays the delivery partner and leaves the platform a margin.
    #
    # eta_minutes is retained because live tracking uses it to estimate arrival
    # once a driver is moving. It is deliberately not advertised as a delivery
    # promise anywhere in the catalogue.
    ("BTL-500-24", "Packaged Drinking Water 500ml (Pack of 24)", "bottle", 0.5, 24, 180, 240,
     "💧", f"{IMG}/bottle-500ml.jpg", "instant", 20, 180,
     "Sealed 500ml bottles, ideal for events, offices and travel. BIS certified."),
    ("BTL-1L-12", "Packaged Drinking Water 1L (Pack of 12)", "bottle", 1.0, 12, 160, 240,
     "🚰", f"{IMG}/bottle-1l.jpg", "instant", 20, 150,
     "Everyday 1 litre bottles in a carry-friendly pack of 12."),
    ("BTL-2L-9", "Packaged Drinking Water 2L (Pack of 9)", "bottle", 2.0, 9, 200, 270,
     "🧴", f"{IMG}/bottle-2l.jpg", "instant", 25, 120,
     "Family-size 2 litre bottles. Best value per litre in the bottle range."),
    ("BTL-CASE-48", "Bulk Bottle Case 500ml (Pack of 48)", "bottle", 0.5, 48, 330, 480,
     "📦", f"{IMG}/bottle-pack.jpg", "same_day", 45, 80,
     "Double case for functions, site offices and long meetings."),

    ("CAN-15L-1", "15L Mineral Water Can (Single)", "can", 15.0, 1, 20, 30,
     "🥛", f"{IMG}/can-20l-alt.jpg", "instant", 30, 300,
     "Compact jar for a small family or a single room. Rs 15 at the shop, Rs 20 delivered. Empty can exchanged."),
    ("CAN-20L-1", "20L Mineral Water Can (Single)", "can", 20.0, 1, 30, 40,
     "🪣", f"{IMG}/can-20l.jpg", "instant", 30, 300,
     "The daily-use 20 litre jar, RO purified and UV treated. Rs 20 at the shop, Rs 30 delivered. Empty can exchanged."),
    ("CAN-20L-3", "20L Mineral Water Can (Pack of 3)", "can", 20.0, 3, 80, 120,
     "📦", f"{IMG}/can-bulk.jpg", "instant", 40, 200,
     "Three 20L jars in one trip, so the delivery cost is shared. Most popular with families."),
    ("CAN-20L-10", "20L Mineral Water Can (Pack of 10)", "can", 20.0, 10, 250, 400,
     "🏭", f"{IMG}/can-pump.jpg", "same_day", 60, 90,
     "Bulk pack of ten 20L jars for offices, hostels and PGs. Best rate per jar."),

    ("CMP-50L", "50L Water Camper with Tap", "camper", 50.0, 1, 150, 220,
     "🍶", f"{IMG}/camper-50l.jpg", "instant", 45, 60,
     "Insulated 50 litre camper with a dispensing tap. Great for small gatherings."),
    ("CMP-100L", "100L Party Camper (Chilled)", "camper", 100.0, 1, 280, 400,
     "🎉", f"{IMG}/camper-party.jpg", "same_day", 90, 40,
     "Chilled 100 litre camper for parties and functions. Stand included."),
    ("CMP-200L", "200L Event Camper (Chilled + Stand)", "camper", 200.0, 1, 520, 750,
     "🎪", f"{IMG}/camper-pour.jpg", "scheduled", 150, 25,
     "Large 200 litre chilled camper for weddings and large events."),
    ("CMP-OFC-50", "Office Dispenser Camper 50L (Hot & Cold)", "camper", 50.0, 1, 220, 320,
     "🏢", f"{IMG}/camper-office.jpg", "same_day", 90, 35,
     "Hot-and-cold dispenser camper on a monthly-friendly rate. Popular with offices."),
]


TANKER_TIERS = [
    # Per-trip, delivery included. A tanker's cost is the round trip and the
    # driver's time rather than the water, so these track what a private
    # operator charges locally, with the platform's margin on top. Larger
    # loads cost less per litre, which is how the trade actually prices.
    ("TNK-IND-1000", 1000, "individual", 300, 90, f"{IMG}/tanker-truck.jpg",
     "Compact tanker for a single home, a small top-up or garden use."),
    ("TNK-IND-2000", 2000, "individual", 500, 120, f"{IMG}/tanker-rural.jpg",
     "Standard household tanker. Covers a typical family for 3 to 4 days."),
    ("TNK-IND-5000", 5000, "individual", 950, 150, f"{IMG}/tanker-yellow.jpg",
     "Large household or small-function tanker."),
    ("TNK-SOC-5000", 5000, "society", 875, 150, f"{IMG}/tanker-yellow.jpg",
     "Society rate for a 5000L trip. Best for small apartment blocks."),
    ("TNK-SOC-8000", 8000, "society", 1320, 180, f"{IMG}/tanker-street.jpg",
     "Bulk 8000L trip for societies, schools and institutions."),
    ("TNK-SOC-12000", 12000, "society", 1850, 210, f"{IMG}/tanker-truck.jpg",
     "Largest tanker on the platform. For large RWAs and construction sites."),
]

VENDORS = [
    # name, phone, lat_off, lng_off, rating, count, completed, verified, kyc,
    # min_cap, max_cap, price, zones, tagline, source, certs, tested,
    # supports_events, area, event_contact
    ("Indore Aqua Care", "9822001133", 0.021, -0.018, 4.8, 210, 486, True, KYC_APPROVED,
     1000, 8000, 850, "3,4,7", "Round-the-clock tankers and cans across west Indore.",
     "Deep borewell + 5-stage RO", "ISI marked, FSSAI licensed", "2026-07-28",
     True, "Vijay Nagar, Scheme 54, Bengali Square", "Rakesh Pawar"),
    ("Shree Ganesh Tankers", "9827114520", -0.032, 0.024, 4.7, 168, 392, True, KYC_APPROVED,
     2000, 12000, 580, "1,2,5", "Bulk tanker specialists for societies and sites.",
     "Municipal + borewell blend", "ISI marked", "2026-08-02",
     True, "Rajwada, Sanyogitaganj, Chhawni", "Mahesh Yadav"),
    ("RK Water Suppliers", "9893227741", 0.014, 0.036, 4.5, 96, 214, True, KYC_APPROVED,
     1000, 5000, 400, "4,6", "Affordable daily cans and mid-size tankers.",
     "Borewell + RO", "FSSAI licensed", "2026-07-15",
     False, "Palasia, Geeta Bhawan", None),
    ("Narmada Jal Seva", "9977330012", -0.018, -0.041, 4.6, 143, 305, True, KYC_APPROVED,
     2000, 8000, 650, "2,3,8", "Narmada-line water, delivered on schedule.",
     "Narmada municipal line", "ISI marked, FSSAI licensed", "2026-08-10",
     True, "Annapurna, Rajendra Nagar", "Sunita Chouhan"),
    ("Malwa Pure Water Co.", "9826558890", 0.045, 0.012, 4.4, 74, 158, True, KYC_APPROVED,
     1000, 5000, 500, "5,6,7", "Packaged water and campers for offices and events.",
     "5-stage RO + UV", "ISI marked", "2026-06-30",
     True, "Scheme 78, Nipania, Bicholi", "Imran Sheikh"),
    ("Sai Krupa Tanker Service", "9755440021", -0.052, 0.031, 4.2, 51, 97, True, KYC_APPROVED,
     2000, 12000, 560, "1,8,9", "Construction and society tankers at short notice.",
     "Borewell", "Registered operator", "2026-05-22",
     False, "Dewas Naka, Lasudia", None),
    ("Vaishnavi Water Point", "9770112233", 0.008, -0.052, 4.9, 38, 71, True, KYC_APPROVED,
     1000, 3000, 450, "4,5", "Small-batch, high-purity cans for homes.",
     "7-stage RO + UV + mineral", "ISI marked, FSSAI licensed", "2026-08-14",
     True, "Sudama Nagar, Gumasta Nagar", "Priya Rathore"),
    # Deliberately left pending so the admin KYC screen has something to action.
    ("Ujjwal Jal Suppliers", "9691004455", 0.061, -0.033, 4.0, 6, 9, False, KYC_PENDING,
     1000, 5000, 500, "9,10", "New operator awaiting verification.",
     "Borewell", "Application submitted", None,
     False, "Super Corridor, Hatod", None),
]

# vendor name -> drivers who work under that operator
DRIVERS = {
    "Indore Aqua Care": [
        ("Ramesh Yadav", "9822700101", "MP09 KA 4412", 8000, 12, 4.9, 640,
         "Hindi, English, Marathi", "Day (6 AM - 6 PM)"),
        ("Sohan Patel", "9822700102", "MP09 LB 2287", 5000, 7, 4.7, 388,
         "Hindi, Gujarati", "Night (6 PM - 6 AM)"),
        ("Dinesh Malviya", "9822700103", "MP09 KC 9051", 2000, 4, 4.6, 210,
         "Hindi", "Day (6 AM - 6 PM)"),
    ],
    "Shree Ganesh Tankers": [
        ("Mahendra Singh Rathore", "9827700201", "MP09 GB 7734", 12000, 15, 4.8, 812,
         "Hindi, Rajasthani", "Day (6 AM - 6 PM)"),
        ("Arun Verma", "9827700202", "MP09 HD 1190", 8000, 9, 4.6, 455,
         "Hindi, English", "Rotational"),
    ],
    "RK Water Suppliers": [
        ("Kailash Chouhan", "9893700301", "MP09 JC 5567", 5000, 6, 4.5, 298,
         "Hindi", "Day (6 AM - 6 PM)"),
        ("Vikas Solanki", "9893700302", "MP09 JD 8823", 3000, 3, 4.4, 141,
         "Hindi, English", "Evening (2 PM - 11 PM)"),
    ],
    "Narmada Jal Seva": [
        ("Shyam Sundar Joshi", "9977700401", "MP09 FA 3308", 8000, 11, 4.7, 520,
         "Hindi, Marathi", "Day (6 AM - 6 PM)"),
        ("Naresh Bhilala", "9977700402", "MP09 FB 6612", 5000, 5, 4.5, 233,
         "Hindi", "Night (6 PM - 6 AM)"),
    ],
    "Malwa Pure Water Co.": [
        ("Irfan Khan", "9826700501", "MP09 MC 2244", 5000, 8, 4.6, 361,
         "Hindi, Urdu, English", "Day (6 AM - 6 PM)"),
    ],
    "Sai Krupa Tanker Service": [
        ("Bharat Lal Sisodiya", "9755700601", "MP09 NB 7719", 12000, 14, 4.3, 476,
         "Hindi", "Day (6 AM - 6 PM)"),
        ("Pankaj Nagar", "9755700602", "MP09 NC 4405", 8000, 6, 4.2, 188,
         "Hindi", "Rotational"),
    ],
    "Vaishnavi Water Point": [
        ("Ganesh Parmar", "9770700701", "MP09 PD 1123", 3000, 5, 4.9, 205,
         "Hindi, English", "Day (6 AM - 6 PM)"),
    ],
}

WATER_DEPARTMENTS = [
    ("Zone 1", "Indore", "Jal Sansthan Zone 1 Office, Indore Municipal Corp.",
     "Nehru Stadium Road, Indore 452001", "0731-2451001", "1916", "0731-2451051", 0.012, 0.008),
    ("Zone 2", "Indore", "Jal Sansthan Zone 2 Office, Indore Municipal Corp.",
     "Sanyogitaganj, Indore 452001", "0731-2451002", "1916", "0731-2451052", -0.021, 0.019),
    ("Zone 3", "Indore", "Jal Sansthan Zone 3 Office, Indore Municipal Corp.",
     "Vijay Nagar, Indore 452010", "0731-2451003", "1916", "0731-2451053", 0.038, 0.041),
    ("Zone 4", "Indore", "Jal Sansthan Zone 4 Office, Indore Municipal Corp.",
     "Rajwada Main Road, Indore 452002", "0731-2451000", "1916", "0731-2451050", 0.002, -0.003),
    ("Zone 5", "Indore", "Jal Sansthan Zone 5 Office, Indore Municipal Corp.",
     "Annapurna Road, Indore 452009", "0731-2451005", "1916", "0731-2451055", -0.029, -0.026),
    ("Zone 6", "Indore", "Jal Sansthan Zone 6 Office, Indore Municipal Corp.",
     "Sudama Nagar, Indore 452009", "0731-2451006", "1916", "0731-2451056", -0.041, -0.011),
    ("Zone 7", "Indore", "Jal Sansthan Zone 7 Office, Indore Municipal Corp.",
     "Scheme No. 78, Indore 452010", "0731-2451007", "1916", "0731-2451057", 0.049, 0.028),
    ("Zone 8", "Indore", "Jal Sansthan Zone 8 Office, Indore Municipal Corp.",
     "Bhawarkuan, Indore 452001", "0731-2451008", "1916", "0731-2451058", -0.017, -0.038),
]


def seed_if_empty() -> None:
    """Idempotent: does nothing if the catalogue already has rows."""
    db = SessionLocal()
    try:
        if db.scalars(select(Product).limit(1)).first() is not None:
            logger.info("Seed data already present, skipping.")
            return

        logger.info("Seeding demo data...")
        lat0, lng0 = CITY_CENTRE

        for (sku, name, cat, cap, pack, price, mrp, emoji, image_url,
             speed, eta, stock, desc) in PRODUCTS:
            db.add(
                Product(
                    sku=sku, name=name, category=cat, capacity_l=cap, pack_size=pack,
                    price=price, mrp=mrp, image=emoji, image_url=image_url,
                    delivery_speed=speed, eta_minutes=eta, stock=stock, description=desc,
                )
            )

        for code, cap, segment, price, eta, image_url, desc in TANKER_TIERS:
            db.add(
                TankerTier(
                    code=code, capacity_l=cap, segment=segment, base_price=price,
                    eta_minutes=eta, image_url=image_url, description=desc,
                )
            )

        # --- Users ---------------------------------------------------------
        customer = User(name="Tejas Tripathi", phone="9876543210",
                        email="tejas@example.com", role=ROLE_CUSTOMER)
        admin = User(name="JAL Admin", phone="9999900000",
                     email="admin@jal24x7.in", role=ROLE_ADMIN)
        db.add_all([customer, admin])
        db.flush()

        db.add(
            Address(
                user_id=customer.id, label="Home",
                line1="12, Scheme No. 54, Vijay Nagar", landmark="Near C21 Mall",
                city="Indore", pincode="452010", zone="Zone 3",
                lat=lat0 + 0.031, lng=lng0 + 0.034, is_default=True,
            )
        )

        # --- Vendors -------------------------------------------------------
        vendors_by_name: dict[str, Vendor] = {}

        for (name, phone, dlat, dlng, rating, rcount, completed, verified, kyc,
             min_cap, max_cap, price, zones, tagline, source, certs, tested,
             does_events, area, event_contact) in VENDORS:

            vendor_user = None
            # Link the flagship vendor to a real login so the panel is demoable.
            if name == "Indore Aqua Care":
                vendor_user = User(name=name, phone=phone, role=ROLE_VENDOR)
                db.add(vendor_user)
                db.flush()

            vendor = Vendor(
                user_id=vendor_user.id if vendor_user else None,
                name=name, phone=phone, tagline=tagline,
                is_verified=verified, kyc_status=kyc,
                kyc_document_ref=f"KYC-{phone[-4:]}",
                rating=rating, rating_count=rcount, completed_orders=completed,
                lat=lat0 + dlat, lng=lng0 + dlng, city="Indore",
                service_zones=zones,
                min_capacity_l=min_cap, max_capacity_l=max_cap, price_per_trip=price,
                is_online=verified, active_load=0, capacity_per_slot=6,
                water_source=source, certifications=certs, last_tested_on=tested,
                supports_events=does_events, area=area,
                event_contact_name=event_contact,
            )
            db.add(vendor)
            vendors_by_name[name] = vendor

        db.flush()

        # --- Tanker drivers -------------------------------------------------
        driver_count = 0
        for vendor_name, roster in DRIVERS.items():
            vendor = vendors_by_name.get(vendor_name)
            if vendor is None:
                continue
            for (dname, dphone, vehicle, vcap, years, drating, trips,
                 languages, shift) in roster:
                db.add(
                    TankerDriver(
                        vendor_id=vendor.id, name=dname, phone=dphone,
                        vehicle_number=vehicle, vehicle_capacity_l=vcap,
                        licence_number=f"MP09/{dphone[-6:]}", experience_years=years,
                        rating=drating, trips_completed=trips,
                        languages=languages, shift=shift, is_available=True,
                    )
                )
                driver_count += 1

        # --- Govt directory -------------------------------------------------
        for zone, city, office, addr, helpline, tanker_line, billing, dlat, dlng in WATER_DEPARTMENTS:
            db.add(
                WaterDepartment(
                    zone=zone, city=city, office_name=office, address=addr,
                    helpline=helpline, tanker_request_line=tanker_line,
                    billing_line=billing, lat=lat0 + dlat, lng=lng0 + dlng,
                )
            )

        db.commit()
        logger.info(
            "Seeded %d products, %d tanker tiers, %d vendors, %d drivers, %d departments.",
            len(PRODUCTS), len(TANKER_TIERS), len(VENDORS), driver_count,
            len(WATER_DEPARTMENTS),
        )
    finally:
        db.close()


if __name__ == "__main__":
    from .database import Base, engine

    logging.basicConfig(level=logging.INFO)
    Base.metadata.create_all(bind=engine)
    seed_if_empty()
