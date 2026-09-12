# JAL 24×7

On-demand water delivery and booking platform. Bottles, 20 litre cans, party campers and bulk
tankers from verified local suppliers, with live order tracking.

MCA (ODL) Semester IV minor project · Devi Ahilya Vishwavidyalaya, Indore

---

## How it fits together

Two programs that talk over HTTP. Both must be running.

```
   Browser  ──►  Frontend (Next.js)  ──►  Backend (FastAPI)  ──►  SQLite
   :3000         pages, UI, maps          API, rules, auth         one file
```

* **Backend** (`backend/`) owns everything that matters: pricing, supplier matching,
  orders, authentication and the live-tracking WebSocket. It is the only thing that
  touches the database.
* **Frontend** (`frontend/`) renders the screens and calls the backend. It stores no
  data and decides no prices, so what you see on screen always came from the API.

Start the backend first. Without it the frontend loads but every screen shows an
error state, because there is nothing to fetch.

---

## Run it locally

You need **Python 3.11+** and **Node.js 20+**. Nothing else — no database to install,
no accounts, no API keys.

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt      # Windows
# python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt   # macOS / Linux
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

Wait for `JAL 24x7 API ready`. On the first run it also creates `jal24x7.db` and
seeds the catalogue, suppliers, drivers and helplines, so the app is never empty.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

### 3. Open it

| What | URL |
| --- | --- |
| Website | http://localhost:3000 |
| API docs (Swagger, try any endpoint) | http://localhost:8000/docs |
| Health check | http://localhost:8000/health |

`npm install` is only needed the first time. After that it is two commands.

### Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Every screen shows an error | The backend is not running. Check http://localhost:8000/health |
| `ModuleNotFoundError` on start | Dependencies went to the wrong interpreter. Use `.venv/Scripts/python -m ...`, not a bare `python` |
| Port already in use | See the Windows note below |
| Want a clean database | Stop the backend, delete `backend/jal24x7.db`, start it again. It reseeds |
| OTP not arriving | It is not sent by SMS. In demo mode the code appears on screen and in the server log |

> **Windows note.** `pkill` does not exist here. To free a stuck port:
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

The project runs on one machine. No cloud account, no hosting bill, no API key and
no external database: the backend serves the API over Uvicorn, the frontend runs on
the Next.js server, and SQLite is a single file created and seeded on first boot.

| Component | Runs on | Address |
| --- | --- | --- |
| Frontend | Next.js server | http://localhost:3000 |
| Backend | Uvicorn (ASGI) | http://localhost:8000 |
| Database | SQLite | `backend/jal24x7.db` |

This is how the project is presented. Everything below is optional.

### Moving it to another machine

Nothing is tied to the machine it was built on.

1. Copy the folder or clone the repository. Exclude `node_modules/`,
   `frontend/.next/` and `backend/.venv/` — they are rebuilt, and copying them
   between machines causes more problems than it solves.
2. Install Python 3.11+ and Node.js 20+.
3. Run the two commands in [Run it locally](#run-it-locally).

The database rebuilds and reseeds itself, so there is nothing to export or import.
To carry existing orders across, copy `backend/jal24x7.db` as well.

### Configuration

Three settings cover every environment. All have working defaults, so local needs none.

| Setting | Where | Default | Change it when |
| --- | --- | --- | --- |
| `DATABASE_URL` | `backend/.env` | SQLite file | Moving to Postgres |
| `CORS_ORIGINS` | `backend/.env` | localhost:3000 | The frontend is on another domain |
| `NEXT_PUBLIC_API_BASE` | `frontend/.env.local` | localhost:8000 | The backend is on another domain |

`NEXT_PUBLIC_*` is inlined when the frontend is built, not read when it runs, so
changing it needs a rebuild rather than a restart.

### Hosting it (future scope)

The code makes no assumption that it is running locally, so hosting is configuration
rather than changes. The backend needs a platform that runs a long-lived process,
because live tracking holds WebSocket connections and advances deliveries on a
background task — serverless functions cannot do either.

Outline, on a free tier:

1. Create a Postgres database and copy its connection string. The driver is already
   in `requirements.txt`, and `config.py` normalises the URL, so no code changes.
2. Deploy `backend/` as a web service. Build `pip install -r requirements.txt`,
   start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set `DATABASE_URL` and
   `JWT_SECRET`.
3. Deploy `frontend/` with root directory `frontend` and `NEXT_PUBLIC_API_BASE` set
   to the backend URL **before** building.
4. Set `CORS_ORIGINS` on the backend to the frontend URL, then redeploy it.

Known caveats on free tiers: instances idle down after a few minutes and take up to
a minute to answer the next request; a free Postgres may expire after a set period;
and SQLite on a hosted instance is wiped on every redeploy, which is why step 1
comes first. These are the reasons the project is presented locally.

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
