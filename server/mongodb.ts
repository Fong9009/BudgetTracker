import mongoose from 'mongoose';

export async function connectToDatabase() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGODB_URI is not set in environment variables');
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

export async function disconnectFromDatabase() {
  try {
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error);
  }
}

export { mongoose };