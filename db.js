import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

let connectPromise;

export async function connection() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Set it in your environment variables.");
  }

  if (!connectPromise) {
    connectPromise = mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10
    }).then(() => mongoose.connection).catch((err) => {
      connectPromise = undefined;
      throw err;
    });
  }

  return connectPromise;
}