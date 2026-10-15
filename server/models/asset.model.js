import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    machineId: {
      type: String,
      required: true,
      unique: true,
      index: true,
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
    machineType: {
      type: String,
    },
    criticality: {
      type: String,
    },
    assetStatus: {
      type: String,
    },
    ratedMaxTempC: {
      type: Number,
    },
    ratedMaxVibrationMmS: {
      type: Number,
    },
    baselinePowerKw: {
      type: Number,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export default mongoose.model('Asset', schema);
