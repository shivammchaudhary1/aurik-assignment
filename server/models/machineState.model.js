import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    machineId: {
      type: String,
      required: true,
      unique: true,
    },
    plantId: {
      type: String,
      required: true,
      index: true,
    },
    lineId: {
      type: String,
      required: true,
    },
    derivedStatus: {
      type: String,
      required: true,
    },
    attentionLevel: {
      type: String,
      required: true,
    },
    needsAttention: {
      type: Boolean,
    },
    reasonCodes: [String],
    latestRelevantEventTime: { type: Date },
    sourceEventRefs: [
      {
        vendor: String,
        sourceId: String,
        eventTime: Date,
        category: String,
        _id: false,
      },
    ],
    latestSignals: [
      {
        vendor: String,
        sourceId: String,
        eventType: String,
        category: String,
        level: Number,
        eventTime: Date,
        _id: false,
      },
    ],
    lastProcessedAt: Date,
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

schema.index({ plantId: 1, lineId: 1 });
export default mongoose.model('MachineState', schema);
