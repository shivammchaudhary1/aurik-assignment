import mongoose from 'mongoose';

export async function connectDb() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 7000 });
  console.log('[db] connected');
}
