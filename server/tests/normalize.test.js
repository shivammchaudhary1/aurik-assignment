import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecord, fingerprint } from '../services/normalizationRules.js';
import { deriveMachineState } from '../services/attentionRules.js';
import { parseCsv } from '../utils/csv.js';
import { validateEnvelope } from '../utils/validation.js';

const asset = { machineId: 'EQ-008', plantId: 'PLANT_02', lineId: 'LINE-E', assetStatus: 'active', ratedMaxTempC: 92, ratedMaxVibrationMmS: 9.5 };
const pulse = { event_id: 'PF-1401', machine_id: 'EQ-008', line_id: 'LINE-E', event_time: '2026-04-18T08:39:10Z',
  event_type: 'RECOVERY_SIGNAL', severity: 'low', vibration_mm_s: 4.0, temperature_c: 70,
  machine_state: 'running', sensor_health: 0.93, vendor_confidence: 0.88 };
const therm = { readingId: 'TW-9921', assetCode: 'EQ-008', productionLine: 'E', timestampMs: 1776500950000,
  alertCode: 'TEMP_CRIT', level: 5, vibration_g: 0.36, temperature_f: 201, power_kw: 34.6, is_active: true, signal_quality: 'GOOD' };
const mainta = { record_id: 'MF-801', machine_ref: 'EQ-008', line_ref: 'LINE-E', recorded_at: '2026/04/18 08:41:00',
  record_type: 'inspection', inspection_result: 'major_defect_found', maintenance_status: 'not_due',
  days_since_last_service: 10, technician_note: 'Heat shield loose', manual_confidence: 'high' };
function norm(vendor, item) { const s = normalizeRecord(vendor, 'PLANT_02', item, asset); return { ...s, fingerprint: fingerprint(s) }; }

test('normalizes the three vendor formats and units', () => {
  const pf = norm('pulseforge', pulse), tw = norm('thermexwatch', therm), mf = norm('maintaflow', mainta);
  assert.equal(pf.category, 'recovery');
  assert.equal(tw.lineId, 'LINE-E');
  assert.equal(tw.metrics.temperatureC, 93.89);
  assert.equal(tw.metrics.vibrationMmS, undefined); // g acceleration != mm/s velocity
  assert.equal(tw.metrics.vibrationG, 0.36);
  assert.equal(mf.eventTime.toISOString(), '2026-04-18T08:41:00.000Z');
});
test('rejects malformed, unknown machine, and mismatched line', () => {
  assert.throws(() => norm('pulseforge', { ...pulse, event_time: '18-04-2026 08:39:10' }), /ISO-8601/);
  assert.throws(() => norm('pulseforge', { ...pulse, vendor_confidence: 1.2 }), /vendor_confidence/);
  assert.throws(() => normalizeRecord('pulseforge', 'PLANT_02', pulse, null), /Unknown machine/);
  assert.throws(() => norm('thermexwatch', { ...therm, productionLine: 'D' }), /does not match/);
});
test('dedupe fingerprint ignores different source ID for identical measurement', () => {
  const a = norm('thermexwatch', therm);
  const b = norm('thermexwatch', { ...therm, readingId: 'TW-9921-R' });
  assert.equal(a.fingerprint, b.fingerprint);
});
test('new PulseForge recovery does not clear ThermexWatch critical or MaintaFlow defect', () => {
  const signals = [norm('pulseforge', { ...pulse, event_id: 'PF-1301', event_type: 'HIGH_VIBRATION', severity: 'high', event_time: '2026-04-18T08:30:00Z', vibration_mm_s: 12 }),
    norm('pulseforge', pulse), norm('thermexwatch', therm), norm('maintaflow', mainta)];
  const state = deriveMachineState(asset, signals);
  assert.equal(state.derivedStatus, 'critical');
  assert.ok(state.reasonCodes.includes('MAJOR_INSPECTION_DEFECT'));
  assert.ok(state.sourceEventRefs.some(s => s.sourceId === 'TW-9921'));
  assert.ok(!state.sourceEventRefs.some(s => s.sourceId === 'PF-1301'));
});
test('newer recovery remains authoritative even when old event arrives later in ingestion', () => {
  const older = norm('pulseforge', { ...pulse, event_id: 'PF-old', event_type: 'HIGH_VIBRATION', severity: 'high', event_time: '2026-04-18T08:00:00Z' });
  const state = deriveMachineState(asset, [norm('pulseforge', pulse), older]);
  assert.equal(state.derivedStatus, 'normal');
});
test('validates envelope and parses quoted CSV', () => {
  assert.equal(validateEnvelope('pulseforge', { vendor: 'PulseForge', plant_id: 'PLANT_02', events: [pulse] }).length, 1);
  assert.throws(() => validateEnvelope('pulseforge', { vendor: 'PulseForge', plant_id: 'PLANT_02', events: [] }), /non-empty/);
  assert.deepEqual(parseCsv('name,note\nEQ-1,"a,b"\n'), [{ name: 'EQ-1', note: 'a,b' }]);
});
