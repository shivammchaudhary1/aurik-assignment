# Aurik — Industrial Equipment Monitoring

A simple **Node.js + Express + MongoDB** project for the Aurik Technologies Tech Lead take-home assessment. It receives equipment data from different vendors, converts it to a common format, processes it in the background, and reports which machines need attention. A small React dashboard is included for demonstration.

## What the assignment asks for

1. **Ingest** data from at least two vendors with different JSON formats.
2. **Normalize** machine IDs, event types, dates, values and units into one format.
3. **Process asynchronously**, with job status, duplicate handling and errors.
4. **Calculate machine attention** using clear, explainable rules (not machine learning).
5. **Provide APIs** for ingestion status, individual machines, and plant/line summaries.
6. **Document and demonstrate** the approach, trade-offs and meaningful tests.

This project supports three supplied vendors: **PulseForge**, **ThermexWatch**, and **MaintaFlow**.

## Tech stack

- **Backend:** Node.js, Express.js, MongoDB, Mongoose, JavaScript
- **Frontend (optional):** React, Vite, CSS
- **Validation:** Simple JavaScript checks
- **Background processing:** MongoDB job collection and a polling worker
- **Tests:** Node.js built-in test runner (no Jest or Supertest)

Node.js is used for simplicity, although the assessment mentions Go, Python and C# as preferred languages. No Docker, Redis, Swagger or additional architecture is required to run this version.

## How it works

```text
Vendor JSON (PulseForge / ThermexWatch / MaintaFlow)
                 |
                 v
         Express ingestion API
                 |
                 v
      MongoDB ingestion job (pending)
                 |
                 v
          Background worker
                 |
          Validate + normalize
                 |
                 v
       MongoDB normalized signals
                 |
                 v
       Calculate machine attention
                 |
                 v
          Machine status APIs
                 |
                 v
        React dashboard (optional)
```

**Example:** A PulseForge recovery event does not erase a separate ThermexWatch critical temperature alert or a MaintaFlow major inspection defect. The machine can still need critical attention. The result includes reasons and source event IDs so it is explainable.

## Project structure

```text
Aurik_Tech_Lead_Assessment_Assets/  Provided CSV, JSON and edge-case data
server/
  server.js                        Express entry point
  config/                          MongoDB connection
  models/                          Mongoose collections
  controllers/                     HTTP handlers
  routes/                          API routes
  services/                        Normalization and attention rules
  workers/                         Asynchronous processing
  scripts/                         Reference-data and demo imports
  tests/                           Basic unit tests
  docs/DESIGN_NOTE.md              Detailed assumptions and trade-offs
client/                             Simple React dashboard
```

The backend follows **MVC with a small service layer**. It keeps one `server.js` and does not use a separate `app.js`.

## Local setup (Windows PowerShell)

### Requirements

Install **Node.js 20+**, **npm**, and **MongoDB Community Server**. Start MongoDB locally (its usual connection is `mongodb://127.0.0.1:27017`).

### 1. Install and configure the backend

From the repository directory:

```powershell
cd .\server
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

The default settings are:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/aurik_monitoring
JOB_POLL_MS=1500
MAX_JOB_ATTEMPTS=3
STALE_AFTER_HOURS=24
```

**Important for the currently committed `master` branch:** Before the next step, make these two small code corrections (no restructuring needed):

- In `server/scripts/seed.js`, change the `Asset` and `Line` import paths to `../models/asset.model.js` and `../models/line.model.js`.
- In `server/server.js`, import `startWorker` from `./workers/jobWorker.js` and call `startWorker()` **after** `await connectDb()`. Without it, newly submitted jobs will remain pending.

### 2. Load reference and demo data

Run these commands inside `server/`:

```powershell
npm run seed
npm run demo
```

- `seed` imports the supplied machines and production lines.
- `demo` ingests and processes sample vendor records.

### 3. Start the backend

```powershell
npm run dev
```

The API runs at **http://localhost:5000**. Visit **http://localhost:5000/health** to check that Express is running.

### 4. Start the optional frontend

Open a second PowerShell terminal from the repository root:

```powershell
cd .\client
npm install
npm run dev
```

Open **http://localhost:5173**. The Vite development server proxies API calls to port 5000, so no separate CORS configuration is needed for this local setup.

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Server health check |
| `POST` | `/api/ingest/pulseforge` | Accept PulseForge event batch |
| `POST` | `/api/ingest/thermexwatch` | Accept ThermexWatch readings |
| `POST` | `/api/ingest/maintaflow` | Accept MaintaFlow records |
| `GET` | `/api/jobs/:jobId` | Check processing status and record errors |
| `GET` | `/api/machines/:machineId/status` | Get a machine's derived attention status |
| `GET` | `/api/plants/:plantId/summary` | Get plant-level summary |
| `GET` | `/api/plants/:plantId/lines/:lineId/summary` | Get line-level summary |

A successful ingestion request returns **202 Accepted** with a `job_id`. Poll the job endpoint for `completed`, `partial` or `failed`.

## Quick manual testing (PowerShell)

With the backend running, open another terminal:

```powershell
# API and machine summary
Invoke-RestMethod http://localhost:5000/health
Invoke-RestMethod http://localhost:5000/api/machines/EQ-008/status
Invoke-RestMethod http://localhost:5000/api/plants/PLANT_02/summary

# Ingest the supplied PulseForge JSON sample
$payload = Get-Content .\Aurik_Tech_Lead_Assessment_Assets\vendor_api_samples\pulseforge_sample.json -Raw
$job = Invoke-RestMethod -Uri http://localhost:5000/api/ingest/pulseforge -Method Post -ContentType 'application/json' -Body $payload
Start-Sleep -Seconds 3
Invoke-RestMethod "http://localhost:5000/api/jobs/$($job.job_id)"
```

The last block assumes the terminal is in the **repository root**. You may see a nonzero duplicate count if the demo data was already imported.

The provided `vendor_api_samples/` directory also contains `duplicates.json`, `malformed.json`, `out_of_order.json`, `conflicting_updates.json` and `retry_cases.json` for additional manual checking. For mixed-vendor files, submit each vendor's nested JSON object to that vendor's endpoint.

The brief also requires meaningful tests. The existing built-in tests can be run from `server/`:

```powershell
npm test
```

## Design choices and limitations

- Each vendor uses different field names and formats; the normalization service maps them to one common signal model.
- Valid records in a batch can be processed even if another record is malformed.
- Source IDs and fingerprints are used to recognize duplicates and conflicting updates.
- Events are ordered by their timestamps when machine state is calculated.
- Fahrenheit is converted to Celsius; vibration acceleration (`g`) is **not** treated as the same unit as vibration velocity (`mm/s`).
- Machine attention is calculated using explicit rules and returned with reason codes and source references.
- MongoDB polling keeps the implementation small. A production system would need stronger worker coordination and observability.
- The supplied data is from April 2026, so freshness indicators may report **stale** when tested later.

**Production next steps:** Stronger vendor authentication, rate limiting, monitoring/logging, better retry and dead-letter handling, worker lease renewal, integration testing, and deployment automation.

See [`server/docs/DESIGN_NOTE.md`](server/docs/DESIGN_NOTE.md) for the short design note required by the assessment.

## AI usage disclosure

OpenAI ChatGPT was used to help draft implementation code, review issues, and prepare documentation. The choice of a simple Node.js/Express/Mongoose stack and the final engineering decisions should be reviewed and explained by the candidate.
