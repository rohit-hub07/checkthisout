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
  userid: {
    type: String,
    default: "NA"
  },
  referrer: {
    type: String,
    default: "NA"
  },
  landingUrl: {
    type: String,
    default: "NA"
  }
})

const Data = mongoose.model("Data", dataSchema);

export default Data;