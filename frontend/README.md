# JAL 24×7 — Frontend

Next.js 16 App Router client for the JAL 24×7 water delivery platform. Talks to the
FastAPI backend in [`../backend`](../backend); it holds no database and no business
logic of its own.

See the [project README](../README.md) for the full setup.

## Running it

The backend must be running first, otherwise every screen shows an error state.

```bash
npm install
npm run dev
```

Opens on http://localhost:3000.

## Configuration

One variable, in `.env.local`:

```
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

`NEXT_PUBLIC_*` values are inlined at build time, not read at runtime, so changing
this needs a restart in development and a rebuild in production.

## Layout

```
src/
  app/           routes (App Router; each folder is a URL)
  components/    shared UI: Header, Splash, MapView, TankerBooking, ui primitives
  lib/           api client, formatting, pricing display constants, types
  store/         React context: auth, cart, toasts
public/images/   product photography
```

## Notes

* **Styling** is Tailwind v4, configured through `@theme` in `src/app/globals.css`
  rather than a `tailwind.config` file. Design tokens live there.
* **Fonts**: Inter, loaded via `next/font`.
* **Maps** are Leaflet with OpenStreetMap tiles, which need no API key and no
  billing account. `MapView` is loaded with `ssr: false` because Leaflet touches
  `window` at import time.
* **Images** are served unoptimised (`next.config.ts`). The photographs are already
  sized for the layouts that use them, and skipping the optimiser keeps memory use
  low on a constrained machine.
* **Live tracking** uses a WebSocket to `/api/orders/{code}/ws`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Serve a production build |
| `npm run lint` | ESLint |
