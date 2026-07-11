import mongoose from "mongoose";

/**
 * Establish the MongoDB connection using MONGODB_URI from the environment.
 * Throws if the URI is missing or the connection fails so the caller
 * (server.js) can fail fast on startup.
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not defined in the environment");
  }

  const conn = await mongoose.connect(uri, { dbName: "maintainiq_db" });
  console.log(`MongoDB connected: ${conn.connection.host}`);

  return conn;
};

export default connectDB;
