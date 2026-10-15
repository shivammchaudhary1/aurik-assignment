import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    vendor: {
      type: String,
      required: true,
    },
    sourceId: {
      type: String,
      required: true,
    },
    fingerprint: {
      type: String,
      required: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'IngestionJob',
    },
    machineId: {
      type: String,
      required: true,
      index: true,
    },
    plantId: {
      type: String,
      required: true,
    },
    lineId: {
      type: String,
      required: true,
    },
    eventTime: {
      type: Date,
      required: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    level: {
      type: Number,
      required: true,
      min: 0,
      max: 4,
    },
    metrics: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

schema.index({ vendor: 1, sourceId: 1 }, { unique: true });
schema.index({ vendor: 1, fingerprint: 1 }, { unique: true });
schema.index({ machineId: 1, eventTime: -1 });

export default mongoose.model('Signal', schema);
