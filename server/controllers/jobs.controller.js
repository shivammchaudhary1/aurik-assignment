import mongoose from 'mongoose';
import IngestionJob from '../models/ingestionJob.model.js';
export async function getJob(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.jobId)) return res.status(400).json({ error: 'Invalid job ID' });
    const job = await IngestionJob.findById(req.params.jobId).lean();
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.json({ job_id: String(job._id), vendor: job.vendor, status: job.status, schema_version: job.schemaVersion,
      total: job.total, inserted: job.inserted, duplicates: job.duplicates, rejected: job.rejected,
      issues: job.issues, attempts: job.attempts, last_error: job.lastError || null,
      created_at: job.createdAt, completed_at: job.completedAt || null });
  } catch (err) { next(err); }
}
