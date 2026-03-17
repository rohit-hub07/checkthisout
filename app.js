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

function safeParseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function decodeUrlValue(value) {
  let decoded = (value || "").trim();

  for (let i = 0; i < 2; i += 1) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      break;
    }
  }

  return decoded;
}

function extractNestedRedirectUrl(value) {
  const parsed = safeParseUrl(value);
  if (!parsed) {
    return "";
  }

  const redirectKeys = ["u", "url", "target", "redirect", "redirect_uri", "r"];
  for (const key of redirectKeys) {
    const nestedValue = parsed.searchParams.get(key);
    if (!nestedValue) {
      continue;
    }

    const decoded = decodeUrlValue(nestedValue);
    if (safeParseUrl(decoded)) {
      return decoded;
    }
  }

  return "";
}

function isInstagramProfileUrl(value) {
  const parsed = safeParseUrl(value);
  if (!parsed) {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  if (!host.endsWith("instagram.com")) {
    return false;
  }

  if (host === "l.instagram.com") {
    return false;
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length !== 1) {
    return false;
  }

  const blockedPaths = new Set(["p", "reel", "reels", "stories", "explore", "accounts", "about", "developer"]);
  return !blockedPaths.has(parts[0].toLowerCase());
}

function getCapturedUserUrl(req, bodyUserUrl) {
  const headerReferrer = req.get("referer") || "";
  const candidates = [
    bodyUserUrl,
    req.query?.userUrl,
    req.query?.ig_user_url,
    req.query?.userid,
    req.query?.u,
    headerReferrer
  ].filter(Boolean);

  const expandedCandidates = [];
  for (const candidate of candidates) {
    const decodedCandidate = decodeUrlValue(candidate);
    expandedCandidates.push(decodedCandidate);

    const nestedUrl = extractNestedRedirectUrl(decodedCandidate);
    if (nestedUrl) {
      expandedCandidates.push(nestedUrl);
    }
  }

  const instagramProfileUrl = expandedCandidates.find(isInstagramProfileUrl);
  if (instagramProfileUrl) {
    return instagramProfileUrl;
  }

  const firstValidNonRedirectUrl = expandedCandidates.find((candidate) => {
    const parsed = safeParseUrl(candidate);
    return parsed && parsed.hostname.toLowerCase() !== "l.instagram.com";
  });

  return firstValidNonRedirectUrl || "NA";
}

function getReferrerDecodeInfo(referrerValue) {
  const rawReferrer = referrerValue || "NA";
  const decodedRedirectTarget = extractNestedRedirectUrl(rawReferrer) || "NA";

  return { rawReferrer, decodedRedirectTarget };
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
  const { rawReferrer, decodedRedirectTarget } = getReferrerDecodeInfo(savedDoc.referrer);

  res.status(200).json({
    message: "Do not click on any random links!",
    yourip: savedDoc.ip,
    yourcity: ipInfo.city,
    country: ipInfo.country,
    location: ipInfo.loc,
    region: ipInfo.region,
    org: ipInfo.org,
    timezone: ipInfo.timezone,
  });
});

app.post("/", async (req, res) => {
  const bodyUserUrl = req.body?.userUrl || "";
  const { ipInfo, savedDoc } = await saveTracking(req, bodyUserUrl);
  const { rawReferrer, decodedRedirectTarget } = getReferrerDecodeInfo(savedDoc.referrer);

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
    savedReferrer: savedDoc.referrer,
    rawReferrer,
    decodedRedirectTarget
  })
})


app.listen(port, () => {
  console.log(`App is listening to port: ${port}`)
})
