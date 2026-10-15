const VENDORS = {
  pulseforge: { label: 'PulseForge', field: 'events', nameField: 'vendor' },
  thermexwatch: {
    label: 'ThermexWatch',
    field: 'readings',
    nameField: 'source',
  },
  maintaflow: {
    label: 'MaintaFlow',
    field: 'records',
    nameField: 'provider_name',
  },
  workorders: {
    label: 'SeedWorkOrders',
    field: 'orders',
    nameField: 'provider_name',
  },
};
export { VENDORS };
export function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
export function validateEnvelope(vendor, payload, { internal = false } = {}) {
  const spec = VENDORS[vendor];
  if (!spec || (vendor === 'workorders' && !internal))
    throw new Error('Unsupported vendor');
  if (!isPlainObject(payload)) throw new Error('Expected a JSON object');
  if (payload[spec.nameField] !== spec.label)
    throw new Error(`Expected ${spec.nameField} to be ${spec.label}`);
  const items = payload[spec.field];
  if (!Array.isArray(items) || items.length === 0 || items.length > 200)
    throw new Error(
      `${spec.field} must be a non-empty array of up to 200 records`
    );
  if (!items.every(isPlainObject))
    throw new Error(`Every ${spec.field} item must be an object`);
  const plant = payload.plant_id || payload.site_code || payload.factory_id;
  if (typeof plant !== 'string' || !/^PLANT_\d+$/.test(plant))
    throw new Error('A valid plant identifier is required');
  if (payload.schema_version !== undefined && payload.schema_version !== 'v1')
    throw new Error('Only schema_version v1 is supported');
  return items;
}
export function requiredString(value, field) {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`${field} is required`);
  return value.trim();
}
export function oneOf(value, values, field) {
  if (!values.includes(value))
    throw new Error(`${field} must be one of: ${values.join(', ')}`);
  return value;
}
export function numeric(
  value,
  field,
  { min = -Infinity, max = Infinity, optional = true } = {}
) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null;
    throw new Error(`${field} is required`);
  }
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new Error(
      `${field} must be a finite number between ${min} and ${max}`
    );
  return value;
}
export function isoTime(value, field) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)
  )
    throw new Error(`${field} must be ISO-8601 with timezone`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} is invalid`);
  return date;
}
export function epochTime(value, field) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error(`${field} must be epoch milliseconds`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} is invalid`);
  return date;
}
export function maintaTime(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}\/\d\d\/\d\d \d\d:\d\d:\d\d$/.test(value)
  )
    throw new Error('recorded_at must use YYYY/MM/DD HH:mm:ss');
  const iso = value.replaceAll('/', '-').replace(' ', 'T') + 'Z';
  const date = new Date(iso);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 19) !== iso.slice(0, 19)
  )
    throw new Error('recorded_at is invalid');
  return date;
}
export function normalizedLine(value) {
  const str = requiredString(value, 'line reference').toUpperCase();
  if (/^[A-Z]$/.test(str)) return `LINE-${str}`;
  if (/^LINE-[A-Z]$/.test(str)) return str;
  throw new Error('Unrecognized line reference');
}
