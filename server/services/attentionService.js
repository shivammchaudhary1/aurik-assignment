import Asset from '../models/asset.model.js';
import Signal from '../models/signal.model.js';
import MachineState from '../models/machineState.model.js';
import { deriveMachineState, presentState } from './attentionRules.js';
export { presentState };

export async function recomputeMachine(machineId) {
  const asset = await Asset.findOne({ machineId }).lean();
  if (!asset) throw new Error(`Unknown machine ${machineId}`);
  const signals = await Signal.find({ machineId }).sort({ eventTime: 1 }).lean();
  const state = deriveMachineState(asset, signals);
  await MachineState.findOneAndUpdate({ machineId }, { $set: state }, { upsert: true, new: true, runValidators: true });
  return state;
}

