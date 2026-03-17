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

function normalizeIp(rawIp) {
  let ip = rawIp;

  if (ip.startsWith("::ffff:")) {
    ip = ip.replace("::ffff:", "");
  }

  if (ip === "::1" || ip === "127.0.0.1") {
    ip = "8.8.8.8";
  }

  return ip;
}

function getCapturedUserUrl(req, bodyUserUrl) {
  const queryUserUrl = req.query?.userUrl || req.query?.ig_user_url || req.query?.userid;
  const headerReferrer = req.get("referer") || "";

  return bodyUserUrl || queryUserUrl || headerReferrer || "NA";
}

async function saveTracking(req, bodyUserUrl = "") {
  const ip = normalizeIp(req.ip);
  const userUrl = getCapturedUserUrl(req, bodyUserUrl);
  const referrer = req.get("referer") || "NA";
  const landingUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

  const response = await fetch(`https://ipinfo.io/${ip}/json?token=${process.env.API_TOKEN}`);
  const ipInfo = await response.json();

  const savedDoc = await Data.create({
    ...ipInfo,
    userid: userUrl,
    referrer,
    landingUrl
  });

  return { ipInfo, savedDoc };
}

app.use(limiter);
app.set("trust proxy", true);
app.get("/", async (req, res) => {
  const { ipInfo, savedDoc } = await saveTracking(req);

  res.status(200).json({
    message: "Bio link click captured",
    yourip: savedDoc.ip,
    yourcity: ipInfo.city,
    country: ipInfo.country,
    location: ipInfo.loc,
    region: ipInfo.region,
    org: ipInfo.org,
    timezone: ipInfo.timezone,
    savedUserUrl: savedDoc.userid,
    savedReferrer: savedDoc.referrer
  });
});

app.post("/", async (req, res) => {
  const bodyUserUrl = req.body?.userUrl || "";
  const { ipInfo, savedDoc } = await saveTracking(req, bodyUserUrl);

  res.status(200).json({
    message: "Tracking data saved",
    yourip: savedDoc.ip,
    yourcity: ipInfo.city,
    country: ipInfo.country,
    location: ipInfo.loc,
    region: ipInfo.region,
    org: ipInfo.org,
    timezone: ipInfo.timezone,
    savedUserUrl: savedDoc.userid,
    savedReferrer: savedDoc.referrer
  })
})


app.listen(port, () => {
  console.log(`App is listening to port: ${port}`)
})
