import Asset from '../models/asset.model.js';
import MachineState from '../models/machineState.model.js';
import IngestionJob from '../models/ingestionJob.model.js';
import { presentState } from '../services/attentionService.js';

async function summary(req, res, next, filter) {
  try {
    const assets = await Asset.find(filter)
      .sort({ lineId: 1, machineId: 1 })
      .lean();
    if (!assets.length)
      return res
        .status(404)
        .json({ error: 'No assets found for requested plant/line' });
    const saved = await MachineState.find({
      machineId: { $in: assets.map((a) => a.machineId) },
    }).lean();
    const byId = new Map(saved.map((x) => [x.machineId, x]));
    const views = assets.map((asset) =>
      presentState(asset, byId.get(asset.machineId))
    );
    const counts = Object.fromEntries(
      ['unknown', 'normal', 'watch', 'warning', 'high', 'critical'].map((k) => [
        k,
        0,
      ])
    );
    const lineMap = new Map();
    for (const machine of views) {
      counts[machine.derived_status]++;
      if (!lineMap.has(machine.line_id))
        lineMap.set(machine.line_id, {
          line_id: machine.line_id,
          total_machines: 0,
          needing_attention: 0,
          critical_machines: [],
        });
      const line = lineMap.get(machine.line_id);
      line.total_machines++;
      if (machine.needs_attention) line.needing_attention++;
      if (machine.derived_status === 'critical')
        line.critical_machines.push(machine.machine_id);
    }
    const plantId = req.params.plantId;
    const problematicJobs = await IngestionJob.countDocuments({
      status: { $in: ['partial', 'failed'] },
      $or: [
        { 'rawPayload.plant_id': plantId },
        { 'rawPayload.site_code': plantId },
        { 'rawPayload.factory_id': plantId },
      ],
    });
    return res.json({
      plant_id: plantId,
      ...(filter.lineId ? { line_id: filter.lineId } : {}),
      total_machines: assets.length,
      by_status: counts,
      needing_attention: views.filter((v) => v.needs_attention).length,
      critical_machines: views
        .filter((v) => v.derived_status === 'critical')
        .map((v) => v.machine_id),
      stale_machines: views
        .filter((v) => v.freshness.is_stale)
        .map((v) => v.machine_id),
      machines_not_processed: views
        .filter((v) => v.processing_status !== 'processed')
        .map((v) => v.machine_id),
      failed_or_partial_jobs_in_plant: problematicJobs,
      lines: [...lineMap.values()].sort(
        (a, b) =>
          b.needing_attention - a.needing_attention ||
          a.line_id.localeCompare(b.line_id)
      ),
    });
  } catch (err) {
    next(err);
  }
}
export function getPlantSummary(req, res, next) {
  return summary(req, res, next, { plantId: req.params.plantId });
}
export function getLineSummary(req, res, next) {
  return summary(req, res, next, {
    plantId: req.params.plantId,
    lineId: req.params.lineId,
  });
}
