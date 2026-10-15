import mongoose from 'mongoose';

export async function connectDb() {
  const uri =
    process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/aurik_monitoring';
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 7000 });
  console.log('[db] connected');
}
