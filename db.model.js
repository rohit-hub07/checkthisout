import mongoose from "mongoose";

const dataSchema = new mongoose.Schema({
  ip: String,
  city: String,
  region: String,
  country: String,
  loc: String,
  org: String,
  postal: String,
  timezone: String,
  userid: String || "NA"
})

const Data = mongoose.model("Data", dataSchema);

export default Data;