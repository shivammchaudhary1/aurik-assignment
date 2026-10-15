# Design note — Aurik backend MVP

**Scope.** Minimal backend-focused answer to the 24-hour assessment (6–10 hours expected effort). One Express process, a MongoDB database, no external queue, plain validation and deterministic business logic. React is deliberately excluded: backend APIs, not a frontend, are evaluated.

## Data and flow

- `Asset` and `Line` hold CSV reference metadata. Unknown machine, wrong plant or wrong line fail per record; they cannot contaminate aggregate state.
- `IngestionJob` stores original batch payloads, schema version assumption (`v1`), state, attempt count and per-item issues. `202 Accepted` indicates durable queuing, **not** completion.
- `Signal` has normalized event fields, original payload, source ID and a semantic fingerprint with unique compound indexes. This provides reproducible calculations, duplicate avoidance and traceability.
- `MachineState` is a persisted read model recalculated from normalized signals after each processed batch, sorted by `eventTime` to resist out-of-order delivery.
- The polling worker atomically claims a pending job in MongoDB, processes valid records, records malformed siblings and retries unexpected processing errors with bounded backoff.

## Important decision: conflicting signals

Operational recovery is source-scoped. E.g. `EQ-008` has a PulseForge recovery, but ThermexWatch independently reports `TEMP_CRIT` and MaintaFlow reports `major_defect_found`. The machine remains **critical**. Choosing the single latest record regardless of vendor would incorrectly erase safety-related information. Similarly, service completion is not equivalent to an inspection defect being fixed; only a new inspection can supersede that inspection finding.

## Assumptions and choices

- Valid batch envelope; malformed individual records become item errors (`partial`). Invalid envelopes fail early with 400.
- Each vendor ID denotes an **immutable event**. An existing ID with new content is a conflict, not an implicit correction. A production correction mechanism would require versioned amendments.
- MaintaFlow date-time strings without a zone use UTC by explicit assumption.
- Fahrenheit converts to Celsius, but acceleration `g` and velocity `mm/s` are kept distinct rather than performing a physically invalid conversion.
- Sensor `RECOVERY_SIGNAL`/`OK` is source-scoped. Other sensor category updates do not cancel unrelated sensor warnings. Latest category state wins *within each vendor*.
- Freshness is based on `eventTime`, separate from machine safety status. Old demo data will be flagged stale when the service runs months later.
- `maintenance_work_orders.csv` is loaded only by the demo command, via an internal `SeedWorkOrders` adapter, for richer operational context. It is intentionally not offered as a fourth public vendor API.
- User-requested dependencies: Express and Mongoose only; all validation, CSV loading and tests use built-in JavaScript/Node functionality.

## Trade-offs

- Good: short, readable MVC/service code; easy to run with one MongoDB; queryable job statuses; document-level idempotency; raw trace; explainable results.
- Limit: worker's 120-second lease is not continuously renewed, so a very large job or stalled worker could be reclaimed; for these small max-200-record assessment batches it is acceptable. For longer jobs, heartbeat or per-item checkpointing is needed.
- Limit: a worker crash after writing signals but before marking the job complete will replay records. Unique indexes avoid duplicate signals. Counters reflect the final replay attempt rather than summing earlier attempts.
- Limit: no distributed state locks; concurrent workers could recalculate the same machine from different points in time. For production, serialize by machine or use transactional/versioned state updates.
- Limit: missing readings are allowed, but invalid provided measurement values fail. No numerical predictive model or machine-specific learned thresholds.
- Limit: semantic duplicate fingerprints are a pragmatic heuristic, not an authoritative cross-vendor identity or guaranteed duplicate oracle.

## Production next steps

Add vendor-auth and per-tenant authorization, request size/rate controls, structured logging/metrics, worker lease heartbeats and stale-state alerting, pagination, schema migration/versioning, dead-letter redrive, deployment pipeline, integration tests with a disposable MongoDB, and OpenAPI contract generation. Only introduce a dedicated queue if volume or operational needs justify it.

## Manual verification checklist

1. Import assets and vendor samples; check both plant summaries and machine `EQ-008`.
2. Submit `duplicates.json` vendor children; expect `duplicates > 0` and no duplicate Signal documents.
3. Submit `malformed.json` children; expect `partial` with issue indices and valid siblings retained.
4. Submit `out_of_order.json` children; verify older alerts never override a newer recovery.
5. Submit `conflicting_updates.json`; verify independent critical defect/temperature signals remain actionable.
6. Submit `retry_cases.json`; invalid records produce per-item issues; worker infrastructure errors are retried.
7. Rerun `npm run demo`; repeat imports should be idempotent at the normalized-signal level.
