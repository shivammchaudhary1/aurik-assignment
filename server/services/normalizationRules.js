import { createHash } from 'node:crypto';
import { numeric, requiredString, oneOf, isoTime, epochTime, maintaTime, normalizedLine } from '../utils/validation.js';

const severity = { normal: 0, low: 1, medium: 2, high: 3, critical: 4 };
const pulseCategories = { HIGH_VIBRATION: 'vibration', TEMP_SPIKE: 'temperature', SENSOR_HEALTH_DROP: 'sensor_health', POWER_FLUCTUATION: 'power', RECOVERY_SIGNAL: 'recovery' };
const thermCategories = { VIB_WARN: 'vibration', TEMP_WARN: 'temperature', TEMP_CRIT: 'temperature', POWER_DROP: 'power', OK: 'recovery' };
const maintenanceLevels = { not_due: 0, completed: 0, unknown: 0, due_soon: 2, overdue: 3 };
const inspectionLevels = { passed: 0, passed_with_observation: 1, minor_defect_found: 2, major_defect_found: 4, calibration_pending: 2 };

// Return a plain normalized object; all database lookups happen in this wrapper.
export function normalizeRecord(vendor, plantId, raw, asset) {
  if (!asset) throw new Error('Unknown machine_id / asset; seed reference data first');
  if (asset.plantId !== plantId) throw new Error(`Machine belongs to ${asset.plantId}, not ${plantId}`);
  let signal;
  if (vendor === 'pulseforge') {
    const eventType = oneOf(raw.event_type, Object.keys(pulseCategories), 'event_type');
    const severityLabel = oneOf(raw.severity, Object.keys(severity), 'severity');
    signal = {
      sourceId: requiredString(raw.event_id, 'event_id'),
      lineId: normalizedLine(raw.line_id), eventTime: isoTime(raw.event_time, 'event_time'),
      eventType, category: pulseCategories[eventType], level: eventType === 'RECOVERY_SIGNAL' ? 0 : severity[severityLabel],
      metrics: {
        vibrationMmS: numeric(raw.vibration_mm_s, 'vibration_mm_s', { min: 0, max: 1000 }),
        temperatureC: numeric(raw.temperature_c, 'temperature_c', { min: -50, max: 300 }),
        sensorHealth: numeric(raw.sensor_health, 'sensor_health', { min: 0, max: 1 }),
        confidence: numeric(raw.vendor_confidence, 'vendor_confidence', { min: 0, max: 1 })
      },
      details: { machineState: raw.machine_state ?? null }
    };
    if (raw.machine_state !== undefined && raw.machine_state !== null) oneOf(raw.machine_state, ['running', 'idle', 'stopped', 'maintenance'], 'machine_state');
  } else if (vendor === 'thermexwatch') {
    const eventType = oneOf(raw.alertCode, Object.keys(thermCategories), 'alertCode');
    const level = numeric(raw.level, 'level', { min: 1, max: 5, optional: false });
    if (!Number.isInteger(level)) throw new Error('level must be an integer');
    if (typeof raw.is_active !== 'boolean') throw new Error('is_active must be a boolean');
    signal = {
      sourceId: requiredString(raw.readingId, 'readingId'),
      lineId: normalizedLine(raw.productionLine), eventTime: epochTime(raw.timestampMs, 'timestampMs'),
      eventType, category: thermCategories[eventType], level: eventType === 'OK' ? 0 : level - 1,
      metrics: {
        // 'g' is acceleration, 'mm/s' is velocity: converting directly is physically invalid.
        vibrationG: numeric(raw.vibration_g, 'vibration_g', { min: 0, max: 100 }),
        temperatureC: raw.temperature_f == null ? null : Number(((numeric(raw.temperature_f, 'temperature_f', { min: -58, max: 572 }) - 32) * 5 / 9).toFixed(2)),
        powerKw: numeric(raw.power_kw, 'power_kw', { min: 0, max: 100000 })
      },
      details: { active: raw.is_active, quality: oneOf(raw.signal_quality, ['GOOD', 'FAIR', 'POOR'], 'signal_quality') }
    };
  } else if (vendor === 'maintaflow') {
    const eventType = oneOf(raw.record_type, ['inspection', 'maintenance_update', 'operator_note', 'calibration'], 'record_type');
    const inspection = raw.inspection_result == null || raw.inspection_result === '' ? null : oneOf(raw.inspection_result, Object.keys(inspectionLevels), 'inspection_result');
    const maintenance = oneOf(raw.maintenance_status, Object.keys(maintenanceLevels), 'maintenance_status');
    const days = numeric(raw.days_since_last_service, 'days_since_last_service', { min: 0, max: 100000 });
    signal = {
      sourceId: requiredString(raw.record_id, 'record_id'), lineId: normalizedLine(raw.line_ref),
      eventTime: maintaTime(raw.recorded_at), eventType, category: eventType,
      level: eventType === 'inspection' ? (inspection == null ? 0 : inspectionLevels[inspection])
        : eventType === 'maintenance_update' ? maintenanceLevels[maintenance]
        : eventType === 'calibration' ? (inspection === 'calibration_pending' ? 2 : 0) : 1,
      metrics: { daysSinceLastService: days },
      details: { inspectionResult: inspection, maintenanceStatus: maintenance, note: raw.technician_note ?? null,
        manualConfidence: oneOf(raw.manual_confidence, ['low', 'medium', 'high'], 'manual_confidence') }
    };
    if (raw.technician_note != null && typeof raw.technician_note !== 'string') throw new Error('technician_note must be a string');
  } else if (vendor === 'workorders') {
    const status = oneOf(raw.status, ['open', 'closed'], 'status');
    signal = {
      sourceId: requiredString(raw.work_order_id, 'work_order_id'), lineId: normalizedLine(raw.line_id),
      eventTime: isoTime(raw.opened_at, 'opened_at'), eventType: status === 'open' ? 'WORK_ORDER_OPEN' : 'WORK_ORDER_CLOSED',
      category: 'work_order', level: status === 'open' ? 2 : 0,
      metrics: {}, details: { status, type: raw.maintenance_type ?? null, note: raw.notes ?? null }
    };
    if (status === 'closed') signal.eventTime = isoTime(raw.closed_at, 'closed_at');
  } else throw new Error('Unknown vendor');
  if (signal.lineId !== asset.lineId) throw new Error(`Line ${signal.lineId} does not match asset line ${asset.lineId}`);
  return { ...signal, vendor: vendor === 'workorders' ? 'SeedWorkOrders' : ({ pulseforge: 'PulseForge', thermexwatch: 'ThermexWatch', maintaflow: 'MaintaFlow' })[vendor],
    plantId, machineId: asset.machineId, rawPayload: raw };
}

export function fingerprint(signal) {
  const plain = { vendor: signal.vendor, machineId: signal.machineId, eventTime: signal.eventTime.toISOString(),
    eventType: signal.eventType, category: signal.category, level: signal.level, metrics: signal.metrics, details: signal.details };
  // The note is excluded because different source IDs with the same signal are still the same measured event.
  if (plain.details) delete plain.details.note;
  return createHash('sha256').update(JSON.stringify(plain)).digest('hex');
}

