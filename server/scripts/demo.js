import { loadEnvFile } from 'node:process';
try { loadEnvFile?.('.env'); } catch (err) { if (err.code !== 'ENOENT') throw err; }
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { seedReferences } from './seed.js';
import { findAssetsDir, seedCsvFile } from './assetFiles.js';
import { queueIngestion } from '../services/ingestionService.js';
import { processNextJob } from '../workers/jobWorker.js';

const value = v => v === '' ? null : v;
const num = v => v === '' || v == null ? null : Number(v);

function groupJobs(rows, vendor, plantKey, itemKey, nameKey, label, convert) {
  const plants = new Map();
  for (const row of rows) {
    const plant = row[plantKey];
    if (!plants.has(plant)) plants.set(plant, []);
    plants.get(plant).push(convert(row));
  }
  return [...plants].map(([plant, items]) => ({ vendor, payload: { [nameKey]: label,
    [vendor === 'pulseforge' ? 'plant_id' : vendor === 'thermexwatch' ? 'site_code' : vendor === 'maintaflow' ? 'factory_id' : 'plant_id']: plant,
    [itemKey]: items } }));
}
async function loadSeedJobs(root) {
  const [pulse, therm, mainta, orders] = await Promise.all([
    seedCsvFile(root, 'pulseforge_events.csv'), seedCsvFile(root, 'thermexwatch_readings.csv'),
    seedCsvFile(root, 'maintaflow_records.csv'), seedCsvFile(root, 'maintenance_work_orders.csv')
  ]);
  const jobs = [
    ...groupJobs(pulse, 'pulseforge', 'plant_id', 'events', 'vendor', 'PulseForge', r => ({
      event_id: r.event_id, machine_id: r.machine_id, line_id: r.line_id, event_time: r.event_time,
      event_type: r.event_type, severity: r.severity, vibration_mm_s: num(r.vibration_mm_s),
      temperature_c: num(r.temperature_c), machine_state: value(r.machine_state),
      sensor_health: num(r.sensor_health), vendor_confidence: num(r.vendor_confidence)
    })),
    ...groupJobs(therm, 'thermexwatch', 'site_code', 'readings', 'source', 'ThermexWatch', r => ({
      readingId: r.reading_id, assetCode: r.asset_code, productionLine: r.production_line,
      timestampMs: num(r.timestamp_ms), alertCode: r.alert_code, level: num(r.level),
      vibration_g: num(r.vibration_g), temperature_f: num(r.temperature_f), power_kw: num(r.power_kw),
      is_active: r.is_active.toLowerCase() === 'true', signal_quality: r.signal_quality
    })),
    ...groupJobs(mainta, 'maintaflow', 'factory_id', 'records', 'provider_name', 'MaintaFlow', r => ({
      record_id: r.record_id, machine_ref: r.machine_ref, line_ref: r.line_ref,
      recorded_at: r.recorded_at, record_type: r.record_type, inspection_result: value(r.inspection_result),
      maintenance_status: r.maintenance_status, days_since_last_service: num(r.days_since_last_service),
      technician_note: value(r.technician_note), manual_confidence: r.manual_confidence
    })),
    ...groupJobs(orders, 'workorders', 'plant_id', 'orders', 'provider_name', 'SeedWorkOrders', r => ({
      work_order_id: r.work_order_id, machine_id: r.machine_id, line_id: r.line_id,
      opened_at: r.opened_at, closed_at: value(r.closed_at), status: r.status,
      maintenance_type: r.maintenance_type, notes: r.notes
    }))
  ];
  for (const { vendor, payload } of jobs) await queueIngestion(vendor, payload, { internal: true });
  return jobs.length;
}

async function run() {
  await connectDb();
  const root = await seedReferences();
  const count = await loadSeedJobs(root);
  // Happy-path fixture contains all three vendor formats under one root.
  const fixture = JSON.parse(await readFile(resolve(root, 'vendor_api_samples', 'happy_path.json'), 'utf8'));
  for (const name of ['pulseforge', 'thermexwatch', 'maintaflow']) {
    if (fixture[name]) await queueIngestion(name, fixture[name]);
  }
  let processed = 0;
  while (await processNextJob()) processed++;
  console.log(`[demo] queued ${count + 3} batches and processed ${processed} pending jobs`);
  console.log('[demo] GET /api/plants/PLANT_01/summary or /api/machines/EQ-008/status');
}
try { await run(); }
catch (err) { console.error('[demo]', err.stack || err.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
