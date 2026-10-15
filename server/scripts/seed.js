import { loadEnvFile } from 'node:process';
try {
  loadEnvFile?.('.env');
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}
import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Asset from '../models/asset.model.js';
import Line from '../models/line.model.js';
import { connectDb } from '../config/db.js';
import { findAssetsDir, csvFile } from './assetFiles.js';

function asNumber(value) {
  return value === '' || value == null ? null : Number(value);
}
export async function seedReferences() {
  const root = await findAssetsDir();
  const [assets, lines] = await Promise.all([
    csvFile(root, 'asset_reference.csv'),
    csvFile(root, 'line_reference.csv'),
  ]);
  for (const a of assets) {
    await Asset.updateOne(
      { machineId: a.machine_id },
      {
        $set: {
          machineId: a.machine_id,
          plantId: a.plant_id,
          lineId: a.line_id,
          machineType: a.machine_type,
          criticality: a.criticality,
          assetStatus: a.asset_status,
          ratedMaxTempC: asNumber(a.rated_max_temp_c),
          ratedMaxVibrationMmS: asNumber(a.rated_max_vibration_mm_s),
          baselinePowerKw: asNumber(a.baseline_power_kw),
        },
      },
      { upsert: true }
    );
  }
  for (const line of lines) {
    await Line.updateOne(
      { plantId: line.plant_id, lineId: line.line_id },
      {
        $set: {
          plantId: line.plant_id,
          lineId: line.line_id,
          lineName: line.line_name,
          operatingWindow: line.operating_window,
        },
      },
      { upsert: true }
    );
  }
  console.log(
    `[seed] imported ${assets.length} machines and ${lines.length} lines from ${root}`
  );
  return root;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await connectDb();
    await seedReferences();
  } catch (err) {
    console.error('[seed]', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
