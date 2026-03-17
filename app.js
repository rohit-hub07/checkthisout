import express from "express";
import { connection } from "./db.js";
import { rateLimit } from 'express-rate-limit'
import dotenv from "dotenv"
import Data from "./db.model.js";

dotenv.config();

const app = express();

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 200, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-8', // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
	ipv6Subnet: 56, // Set to 60 or 64 to be less aggressive, or 52 or 48 to be more aggressive
	// store: ... , // Redis, Memcached, etc. See below.
})

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
