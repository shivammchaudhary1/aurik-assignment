import Asset from '../models/asset.model.js';
import { requiredString } from '../utils/validation.js';
import { normalizeRecord, fingerprint } from './normalizationRules.js';

export async function normalizeWithAsset(vendor, plantId, raw) {
  const machineId =
    vendor === 'pulseforge'
      ? raw.machine_id
      : vendor === 'thermexwatch'
        ? raw.assetCode
        : vendor === 'maintaflow'
          ? raw.machine_ref
          : raw.machine_id;
  const id = requiredString(machineId, 'machine_id');
  const asset = await Asset.findOne({ machineId: id }).lean();
  const normalized = normalizeRecord(vendor, plantId, raw, asset);
  return { ...normalized, fingerprint: fingerprint(normalized) };
}
