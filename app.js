import express from "express";
import { connection } from "./db.js";
import { rateLimit } from 'express-rate-limit'
import dotenv from "dotenv"
import Data from "./db.model.js";

dotenv.config();

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

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

app.use(limiter);
app.set("trust proxy", true);
app.get("/", async (req, res) => {
  res.status(200).json({
    message: "Send a POST request to / with JSON body: { userUrl: \"https://instagram.com/...\" }"
  });
});

app.post("/", async (req, res) => {
  const userUrl = req.body?.userUrl || "NA";
  let ip = req.ip;

  if (ip.startsWith("::ffff:")) {
    ip = ip.replace("::ffff:", "");
  }

  if (ip === "::1" || ip === "127.0.0.1") {
    ip = "8.8.8.8";
  }

  const response = await fetch(`https://ipinfo.io/${ip}/json?token=${process.env.API_TOKEN}`);

  const data = await response.json();
  console.log("data: ", data)

  const savedDoc = await Data.create({
    ...data,
    userid: userUrl
  });

  res.status(200).json({
    message: "Do not click on any random links!",
    yourip: savedDoc.ip,
    yourcity: data.city,
    country: data.country,
    location: data.loc,
    region: data.region,
    org: data.org,
    timezone: data.timezone,
  })
})


app.listen(port, () => {
  console.log(`App is listening to port: ${port}`)
})
