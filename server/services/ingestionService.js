import IngestionJob from '../models/ingestionJob.model.js';
import { validateEnvelope, VENDORS } from '../utils/validation.js';

export async function queueIngestion(vendor, payload, options = {}) {
  const items = validateEnvelope(vendor, payload, options);
  const job = await IngestionJob.create({
    vendor,
    rawPayload: payload,
    total: items.length,
    schemaVersion: payload.schema_version || 'v1',
    status: 'pending',
  });
  return {
    job_id: String(job._id),
    vendor: VENDORS[vendor].label,
    status: job.status,
    accepted_records: job.total,
    status_url: `/api/jobs/${job._id}`,
  };
}
export function plantFromPayload(payload) {
  return payload.plant_id || payload.site_code || payload.factory_id;
}
