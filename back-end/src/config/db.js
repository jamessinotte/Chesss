const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not set');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri);
    console.log(' MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error' , err);
    process.exit(1);
  }
}

module.exports = { connectDB };
