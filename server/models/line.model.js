import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    plantId: {
      type: String,
      required: true,
    },
    lineId: {
      type: String,
      required: true,
    },
    lineName: {
      type: String,
    },
    operatingWindow: {
      type: String,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

schema.index({ plantId: 1, lineId: 1 }, { unique: true });
export default mongoose.model('Line', schema);
