import express from "express";
import { connection } from "./db.js";
import dotenv from "dotenv"
import Data from "./db.model.js";

dotenv.config();

const app = express();

const port = process.env.PORT;

connection();

app.get("/", async(req, res) => {
  const response = await  fetch(process.env.API)
  const data =await response.json();
  console.log("data: ",data);
  await Data.create(data);
  res.status(200).json({
    message: "Please don't click on any random links!",
    yourip: data.ip,
    yourcity: data.city,
    country: data.country,
    location: data.loc,
    region: data.region,
    org: data.org,
    timezone: data.timezone
  })
})


app.listen(port, () => {
  console.log(`App is listening to port: ${port}`)
})
