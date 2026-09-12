# JAL 24×7

On-demand water delivery and booking platform. Bottles, 20 litre cans, party campers and bulk
tankers from verified local suppliers, with live order tracking.

MCA (ODL) Semester IV minor project · Devi Ahilya Vishwavidyalaya, Indore

---

## Run it locally

Two terminals, from this folder.

**Terminal 1, backend**

```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # macOS / Linux
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2, frontend**

```bash
cd frontend
npm install
npm run dev
```

| What | URL |
| --- | --- |
| Website | http://localhost:3000 |
| API docs (Swagger) | http://localhost:8000/docs |
| Health check | http://localhost:8000/health |

The database is created and seeded automatically on first boot. No setup steps, no accounts,
no API keys.

> **Windows note.** `pkill` does not work here. If port 8000 or 3000 is stuck:
> ```powershell
> Get-NetTCPConnection -LocalPort 8000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
> ```

---

## Demo logins

Login is by OTP. In demo mode the code is displayed on screen, so no SMS gateway is needed.

| Role | Mobile number | Lands on |
| --- | --- | --- |
| Customer | `9876543210` | `/orders` |
| Vendor | `9822001133` | `/vendor` |
| Admin | `9999900000` | `/admin` |

Any other valid 10 digit Indian mobile number creates a new customer account.

**Test payment values**

| Method | Value |
| --- | --- |
| Card | `4111 1111 1111 1111`, any future expiry, any CVV |
| UPI ID | anything shaped like `name@okhdfcbank` |
| UPI app / net banking / COD | just select and pay |

---

## Tech stack

| Layer | Choice | Why this one |
| --- | --- | --- |
| Frontend | Next.js 16, React 19, TypeScript | App Router, file-based routing, first-class TypeScript. |
| Styling | Tailwind CSS v4 | Design tokens defined in CSS, no config file, no component library to fight. |
| Backend | Python, FastAPI | Satisfies the Python requirement from the synopsis. Async, and generates Swagger docs automatically. |
| ORM | SQLAlchemy 2.0 | Same models work on SQLite and Postgres. Parameter binding prevents SQL injection. |
| Database | SQLite locally, Postgres ready | Zero setup for the demo. Switching is one `DATABASE_URL` change. |
| Auth | OTP + JWT (PyJWT) | Password-free, matches how Indian apps actually log people in. |
| Password hashing | PBKDF2-HMAC-SHA256, stdlib | 600,000 iterations, NIST approved, no C compiler needed. |
| Realtime | FastAPI WebSocket | Replaces Supabase Realtime. Keeps the live-tracking logic inside the Python codebase. |
| Maps | Leaflet + OpenStreetMap | Free with no API key. Google Maps now needs a billing account even on the free tier. |
| Payments | Simulated gateway | Real validation (VPA format, Luhn card checksum, HMAC signature), no money moves. |

### Free external APIs used

All three are key-less and are called from the backend, not the browser, so there are no CORS
problems and no keys to leak. Each one fails soft: if the service is down the page still works.

| API | Used for | Where you see it |
| --- | --- | --- |
| Open-Meteo | Weather at the delivery pin | Home page banner: "38°C today, households order 40% more" |
| OpenStreetMap Nominatim | Reverse geocoding | Turning a dropped map pin into a street address |
| api.postalpincode.in | Indian PIN code lookup | Quick-order serviceability check on the home page |

---

## Project structure

```
Jal 24 Seven/
├── backend/                    FastAPI application
│   ├── app/
│   │   ├── main.py             App entry point, router registration, CORS
│   │   ├── config.py           Settings, all environment driven
│   │   ├── database.py         SQLAlchemy engine and session
│   │   ├── models.py           13 tables
│   │   ├── schemas.py          Pydantic request/response contract
│   │   ├── security.py         OTP, JWT, password hashing
│   │   ├── validators.py       Input sanitisation and text casing
│   │   ├── middleware.py       Security headers, rate limiting, body size cap
│   │   ├── seed.py             Demo data
│   │   ├── routers/            12 route modules
│   │   └── services/           Business logic
│   │       ├── matching.py     Vendor matching and scoring
│   │       ├── pricing.py      Pricing, discounts, GST
│   │       ├── tracking.py     Live tracking and WebSocket fan-out
│   │       ├── cart.py         Server-side cart pricing
│   │       └── geo.py          Distance and ETA maths
│   └── smoke_test.py           133 end-to-end checks
│
└── frontend/                   Next.js application
    ├── src/app/                20 routes
    ├── src/components/         Shared UI
    ├── src/lib/                API client, types, formatting
    ├── src/store/              Auth, cart and toast context
    └── public/images/products/ 16 product photographs
```

---

## Screens

| Route | What it does |
| --- | --- |
| `/` | Landing page: hero, problem, solution, quick order, why us, FAQ |
| `/products` | Catalogue with category tabs, filters and sorting |
| `/tankers` | Tanker chooser, splits into two modules |
| `/tankers/home` | Individual and home tanker booking |
| `/tankers/society` | Society and institutional booking, contract pricing |
| `/suppliers` | Supplier marketplace with a Leaflet map |
| `/drivers` | Driver roster grouped by operator |
| `/events` | Party and event sizing calculator plus contacts |
| `/subscriptions` | Recurring camper plans and society contracts |
| `/cart` | Cart with server-computed totals |
| `/checkout` | Address with map pin, slot, payment sheet |
| `/login` | OTP login |
| `/track/[code]` | Live tracking over WebSocket |
| `/orders` | Order history, reorder, cancel |
| `/contact` | Contact form and government zone directory |
| `/admin` | Admin dashboard, analytics, vendor KYC |
| `/vendor` | Vendor panel, assigned orders, listing |
| `/water-quality` | Purification and certification information |
| `/terms`, `/privacy` | Legal pages |

---

## Security

| Measure | Where |
| --- | --- |
| Prices always recomputed server-side | `services/cart.py`. The client sends ids and quantities only. |
| Order codes are random, not sequential | `routers/orders.py`. Stops people enumerating other orders. |
| Ownership checked on every order action | Reading, cancelling or paying for someone else's order returns 404. |
| Role checks on admin and vendor routes | `security.py` dependencies. |
| Input sanitisation | `validators.py` strips scripts and tags, normalises casing. |
| Rate limiting | 5 OTP sends per 5 minutes per IP, plus limits on login and checkout. |
| Security headers | CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy. |
| SQL injection | Prevented by SQLAlchemy parameter binding. |
| XSS | React escapes all text, and nothing uses `dangerouslySetInnerHTML`. |
| Body size cap | Requests above 1 MB rejected before parsing. |

---

## Tests

```bash
cd backend
.venv/Scripts/python smoke_test.py
```

133 checks across 16 areas: catalogue, vendor matching, OTP, pricing, checkout, tracking,
history, subscriptions, contact, admin, vendor panel, drivers, events, payments, security
hardening and external API integrations. Runs against a throwaway database.

---

## Deployment

The project runs entirely on one machine. There is no cloud account, no hosting
bill, no API key and no external database to provision: the backend serves the API
over Uvicorn, the frontend runs on the Next.js server, and SQLite lives in a single
file that is created and seeded on first boot.

| Component | Runs on | Address |
| --- | --- | --- |
| Frontend | Next.js server | http://localhost:3000 |
| Backend | Uvicorn (ASGI) | http://localhost:8000 |
| Database | SQLite | `backend/jal24x7.db` |

Start both as described in [Run it locally](#run-it-locally).

### Moving it to another machine

Clone the repository, or copy the folder excluding `node_modules/`, `frontend/.next/`
and `backend/.venv/`, then follow the same two commands. Nothing is tied to the
machine it was built on, and no configuration is needed: the database rebuilds and
reseeds itself the first time the backend starts.

### Cloud readiness

Nothing in the code assumes it is running locally, so a cloud deployment needs
configuration rather than changes:

* `DATABASE_URL` switches SQLite for Postgres. The driver ships in
  `requirements.txt` and `config.py` normalises the URL, so no model or query is
  affected.
* `CORS_ORIGINS` lists the deployed frontend origin.
* `NEXT_PUBLIC_API_BASE` points the frontend at the deployed API.

This was validated on a free hosting tier during development. It is recorded here as
future scope rather than a live deployment, because free tiers idle their instances
down after a few minutes and take up to a minute to answer the next request, which
is a poor way to present the work. Running locally is immediate and reliable.

## Notes for the report

Deliberate deviations from the original synopsis, each with a reason:

1. **Google Maps → Leaflet + OpenStreetMap.** Google Maps requires a billing account even on the
   free tier. Leaflet needs no key and no card.
2. **Django/Flask → FastAPI.** Still Python. Adds automatic OpenAPI documentation, native async
   for WebSockets, and Pydantic validation at the boundary.
3. **Separate notification service → FastAPI WebSocket.** One less service to host, and the
   realtime logic stays in the graded Python codebase.
4. **Real SMS → on-screen OTP in demo mode.** SMS gateways cost money per message. The switch is
   one environment variable and one function in `routers/auth.py`.
5. **Real payment gateway → simulated gateway.** Validation logic is genuine (VPA format, Luhn
   checksum, HMAC signature the way Razorpay does it), but no money moves.
