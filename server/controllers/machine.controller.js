import Asset from '../models/asset.model.js';
import MachineState from '../models/machineState.model.js';
import { presentState } from '../services/attentionService.js';
export async function getMachine(req, res, next) {
  try {
    const asset = await Asset.findOne({ machineId: req.params.machineId }).lean();
    if (!asset) return res.status(404).json({ error: 'Unknown machine' });
    const state = await MachineState.findOne({ machineId: asset.machineId }).lean();
    return res.json(presentState(asset, state));
  } catch (err) { next(err); }
}
