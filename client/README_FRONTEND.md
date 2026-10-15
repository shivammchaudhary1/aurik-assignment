# Aurik Equipment Monitor — Simple React Client

Small optional UI for the Aurik Founding Tech Lead backend. **No added npm dependencies:** uses the repository's existing React + Vite packages, plain CSS, and native `fetch`.

## What is included

- **Overview**: plant switcher, line filter, counts, status distribution, and line attention.
- **Machine list & details**: derived status, reasons, freshness, processed source events.
- **Data ingestion**: choose PulseForge, ThermexWatch, or MaintaFlow; load a sample, upload a JSON file, or paste JSON; post it to the API; see background job status and per-record errors.
- Loading, backend-offline, empty, and error states.

The plant/line/machine **reference labels** are derived from `Aurik_Tech_Lead_Assessment_Assets/{asset_reference,line_reference}.csv` and copied into `src/data/assets.js`. **Operational status is never hardcoded**; it is requested from the backend. The assessment only includes eight machines, making this a reasonable small-demo shortcut. Add a backend assets-list endpoint for dynamic discovery in production.

## Run locally

Open **two terminals** after MongoDB has been started. If you have not yet prepared the backend data, seed and demo it once:

```bash
# Terminal 1, from project root
cd server
npm install
npm run seed
npm run demo
npm start
```

```bash
# Terminal 2, from project root
cd client
npm install     # skip if already installed
npm run dev
```

Open **http://localhost:5173**. For reliable results, `server` should be on **http://localhost:5000**.

**No CORS changes needed in development:** Vite `server.proxy` sends `/api` and `/health` requests to port 5000 on the same machine. When hosting frontend and backend on different origins outside Vite development, set `VITE_API_BASE_URL` in the frontend build environment AND configure appropriate CORS on the backend (or serve both behind one reverse-proxy origin).

## API integration

| Frontend feature | Backend API |
| --- | --- |
| Connection indicator | `GET /health` |
| Plant counts and lines | `GET /api/plants/:plantId/summary` |
| Line filter counts | `GET /api/plants/:plantId/lines/:lineId/summary` |
| Machine status/reasons/signals | `GET /api/machines/:machineId/status` |
| Data ingestion | `POST /api/ingest/:vendor` |
| Async processing status | `GET /api/jobs/:jobId` |

If backend `INGEST_API_KEY` is set, enter it in the ingestion form; otherwise leave blank. The key is not persisted by this frontend.

## Assessment fixtures and freshness

Buttons marked **Use assessment sample** load copied JSON vendor samples from `public/samples`. These share source IDs with seed/demo data; re-posting may legitimately count as a duplicate.

The assessment events are dated **April 2026**, so the backend freshness field can correctly show *Stale*. That is not a UI error.

## Files changed by installer

Only client-related files are installed. The installer creates a timestamped backup for any existing file it overwrites. `server/`, Git history, and the assessment assets are untouched. No frontend routing framework, charting library, UI kit, or global state package is used.

For production, machine discovery should come from an API rather than the static eight-machine reference list; the goal here is a reviewable assessment demo, not a production SPA.
