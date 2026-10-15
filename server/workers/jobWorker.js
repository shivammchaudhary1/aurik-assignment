import IngestionJob from '../models/ingestionJob.model.js';
import Signal from '../models/signal.model.js';
import { normalizeWithAsset } from '../services/normalizeService.js';
import { recomputeMachine } from '../services/attentionService.js';
import { plantFromPayload } from '../services/ingestionService.js';
import { VENDORS } from '../utils/validation.js';

let running = false;
let timer;
const LEASE_MS = 120000;

async function insertSignal(signal, job) {
  const existingById = await Signal.findOne({
    vendor: signal.vendor,
    sourceId: signal.sourceId,
  }).lean();
  if (existingById)
    return existingById.fingerprint === signal.fingerprint
      ? 'duplicate'
      : 'conflict';
  const existingByHash = await Signal.findOne({
    vendor: signal.vendor,
    fingerprint: signal.fingerprint,
  }).lean();
  if (existingByHash) return 'duplicate';
  try {
    await Signal.create({ ...signal, jobId: job._id });
    return 'inserted';
  } catch (err) {
    if (err.code !== 11000) throw err;
    const concurrent = await Signal.findOne({
      vendor: signal.vendor,
      sourceId: signal.sourceId,
    }).lean();
    return concurrent && concurrent.fingerprint !== signal.fingerprint
      ? 'conflict'
      : 'duplicate';
  }
}

export async function processJob(job) {
  const spec = VENDORS[job.vendor];
  const entries = job.rawPayload[spec.field];
  const plantId = plantFromPayload(job.rawPayload);
  let inserted = 0,
    duplicates = 0,
    rejected = 0;
  const issues = [];
  const affectedMachines = new Set();
  for (let index = 0; index < entries.length; index++) {
    const raw = entries[index];
    const sourceId =
      raw.event_id ||
      raw.readingId ||
      raw.record_id ||
      raw.work_order_id ||
      null;
    try {
      const signal = await normalizeWithAsset(job.vendor, plantId, raw);
      const outcome = await insertSignal(signal, job);
      if (outcome === 'conflict')
        throw new Error(
          'Conflicting update: source ID reused with different data'
        );
      if (outcome === 'duplicate') duplicates++;
      else inserted++;
      affectedMachines.add(signal.machineId); // Recompute even after retry/replayed job.
    } catch (err) {
      rejected++;
      issues.push({ index, sourceId, message: err.message });
    }
  }
  for (const machineId of affectedMachines) await recomputeMachine(machineId);
  job.set({
    status: rejected ? 'partial' : 'completed',
    inserted,
    duplicates,
    rejected,
    issues,
    lastError: undefined,
    leaseUntil: null,
    completedAt: new Date(),
  });
  await job.save();
}

export async function processNextJob() {
  const now = new Date();
  const job = await IngestionJob.findOneAndUpdate(
    {
      $or: [
        { status: 'pending', nextAttemptAt: { $lte: now } },
        { status: 'processing', leaseUntil: { $lt: now } },
      ],
    },
    {
      $set: {
        status: 'processing',
        leaseUntil: new Date(Date.now() + LEASE_MS),
      },
      $inc: { attempts: 1 },
    },
    { sort: { createdAt: 1 }, new: true }
  );
  if (!job) return false;
  try {
    await processJob(job);
  } catch (err) {
    console.error(`[worker] job ${job._id}:`, err.message);
    const maxAttempts = Number(process.env.MAX_JOB_ATTEMPTS || 3);
    job.set({
      status: job.attempts >= maxAttempts ? 'failed' : 'pending',
      nextAttemptAt: new Date(
        Date.now() + Math.min(30000, 1000 * 2 ** job.attempts)
      ),
      leaseUntil: null,
      lastError: err.message,
    });
    await job.save();
  }
  return true;
}

async function tick() {
  if (running) return;
  running = true;
  try {
    await processNextJob();
  } catch (err) {
    console.error('[worker] polling error:', err.message);
  } finally {
    running = false;
  }
}
export function startWorker() {
  if (timer) return;
  const ms = Math.max(250, Number(process.env.JOB_POLL_MS || 1500));
  timer = setInterval(tick, ms);
  tick();
  console.log(`[worker] polling every ${ms}ms`);
}
export function stopWorker() {
  if (timer) clearInterval(timer);
  timer = undefined;
}
