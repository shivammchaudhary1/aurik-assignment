import mongoose from 'mongoose';

const issueSchema = new mongoose.Schema(
  {
    index: Number,
    sourceId: String,
    message: String,
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    vendor: {
      type: String,
      required: true,
    },
    schemaVersion: {
      type: String,
      default: 'v1',
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'partial', 'failed'],
      default: 'pending',
      index: true,
    },
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    inserted: {
      type: Number,
      default: 0,
    },
    duplicates: {
      type: Number,
      default: 0,
    },
    rejected: {
      type: Number,
      default: 0,
    },
    issues: {
      type: [issueSchema],
      default: [],
    },
    attempts: {
      type: Number,
      default: 0,
    },
    nextAttemptAt: {
      type: Date,
      default: Date.now,
    },
    leaseUntil: {
      type: Date,
    },
    lastError: {
      type: String,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

schema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });
export default mongoose.model('IngestionJob', schema);
