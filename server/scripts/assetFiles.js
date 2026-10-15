import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../utils/csv.js';
const here = fileURLToPath(new URL('.', import.meta.url));

export async function findAssetsDir() {
  const candidates = [process.env.ASSETS_DIR,
    resolve(process.cwd(), '../Aurik_Tech_Lead_Assessment_Assets'),
    resolve(process.cwd(), 'Aurik_Tech_Lead_Assessment_Assets'),
    resolve(here, '../../../Aurik_Tech_Lead_Assessment_Assets')].filter(Boolean);
  for (const root of candidates) {
    try { await access(resolve(root, 'asset_reference.csv')); return root; } catch { /* try next */ }
  }
  throw new Error('Assessment assets directory not found. Set ASSETS_DIR to the absolute path of Aurik_Tech_Lead_Assessment_Assets.');
}
export async function csvFile(root, filename) {
  return parseCsv(await readFile(resolve(root, filename), 'utf8'));
}
export async function seedCsvFile(root, filename) {
  try { return await csvFile(resolve(root, 'seed_data'), filename); }
  catch (err) { if (err.code !== 'ENOENT') throw err; return csvFile(root, filename); }
}
