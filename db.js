import mongoose from "mongoose";
import dotenv  from "dotenv";
dotenv.config();

export async function connection(){
  await mongoose.connect(process.env.MONGO_URI).then(() => "connection successfull").catch((err) => console.log("error: ",err))
}