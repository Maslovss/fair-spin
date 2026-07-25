# Fair Spin

A tactile, offline-first randomizer where the result is derived from the table’s final physical position. Nothing is selected before the wheel stops.

## Development

Requires Node.js 22 or newer.

```sh
npm install
npm run dev
```

Verification:

```sh
npm run typecheck
npm run test
npm run build
```

The production build uses `/fair-spin/` as its base path and is deployed to GitHub Pages by `.github/workflows/deploy.yml`.

## Docker

Build and serve the production application with Nginx:

```sh
docker compose up --build
```

Open `http://localhost:8080/fair-spin/`. Set `FAIR_SPIN_PORT` to publish another host port.

## Core guarantees

- Fixed-step wheel physics at 120 Hz, independent of render cadence.
- A result is derived once from the stopped angle.
- Secure Fisher–Yates shuffling is used for layouts, never to preselect a result.
- Presets, unfinished rounds, wheel angles, and settings stay in local browser storage.
- Ukrainian and English UI, installable PWA, and offline operation after the first load.
