
import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import State, { connectDB } from "./db.js";

const app = express();
const PORT = process.env.PORT || 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const SEED_FILE = path.join(__dirname, "seed.json");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const DIST_DIR = path.resolve(__dirname, "../dist");

app.use(cors());
app.use(express.json());

let state;

// ---------- DATABASE AND STATE ----------

async function save() {
  await State.updateOne(
    { key: "main" },
    { $set: { data: state } },
    { upsert: true }
  );
}

async function initializeState() {
  await connectDB();

  const saved = await State.findOne({ key: "main" }).lean();

  if (saved) {
    state = saved.data;
    console.log("Existing state loaded from MongoDB.");
  } else {
    let initialState;

    if (fs.existsSync(STATE_FILE)) {
      initialState = JSON.parse(
        fs.readFileSync(STATE_FILE, "utf8")
      );
      console.log("Importing existing state.json into MongoDB.");
    } else {
      initialState = JSON.parse(
        fs.readFileSync(SEED_FILE, "utf8")
      );
      console.log("Loading initial seed data into MongoDB.");
    }

    if (!Array.isArray(initialState.claims)) {
      initialState.claims = [];
    }

    state = initialState;
    await save();

    console.log("Initial state saved to MongoDB.");
  }

  if (!Array.isArray(state.claims)) {
    state.claims = [];
    await save();
  }

  await refreshMissedClaims();
}

// ---------- HELPERS ----------

function timeMs(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
  ) {
    return NaN;
  }

  const timestamp = new Date(`${value}:00`).getTime();

  // Reject impossible dates such as February 30.
  if (!Number.isFinite(timestamp)) return NaN;

  const date = new Date(timestamp);
  const normalized =
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

  return normalized === value ? timestamp : NaN;
}

function nowMs() {
  return timeMs(state.clock);
}

function donationFor(id) {
  return state.donations.find((d) => d.id === id);
}

function donorFor(donation) {
  return state.donors.find((d) => d.id === donation.donor_id);
}

function volunteerFor(id) {
  return state.volunteers.find((v) => v.id === id);
}

function remainingKg(donation) {
  const claimed = state.claims
    .filter(
      (c) =>
        c.donation_id === donation.id &&
        c.status !== "CANCELLED"
    )
    .reduce((sum, c) => sum + c.kg, 0);

  return donation.quantity_kg - claimed;
}

function donationStatus(donation) {
  if (donation.cancelled) return "CANCELLED";
  if (nowMs() > timeMs(donation.pickup_until)) return "EXPIRED";
  if (remainingKg(donation) === 0) return "FULLY_CLAIMED";
  return "OPEN";
}

async function refreshMissedClaims() {
  let changed = false;

  for (const claim of state.claims) {
    const donation = donationFor(claim.donation_id);

    if (
      donation &&
      claim.status === "ACTIVE" &&
      nowMs() > timeMs(donation.pickup_until)
    ) {
      claim.status = "MISSED";
      changed = true;
    }
  }

  if (changed) {
    await save();
  }
}

function validWholeKg(value) {
  return Number.isInteger(value) && value >= 1;
}

// ---------- DASHBOARD ----------

function dashboard() {
  const donations = state.donations.filter((d) => !d.cancelled);

  const sumClaims = (status) =>
    state.claims
      .filter(
        (c) =>
          c.status === status &&
          donations.some((d) => d.id === c.donation_id)
      )
      .reduce((sum, c) => sum + c.kg, 0);

  const listed = donations.reduce(
    (sum, d) => sum + d.quantity_kg,
    0
  );

  const collected = sumClaims("COLLECTED");
  const missed = sumClaims("MISSED");
  const inProgress = sumClaims("ACTIVE");

  const wasted = donations
    .filter((d) => donationStatus(d) === "EXPIRED")
    .reduce((sum, d) => sum + remainingKg(d), 0);

  const stillOpen = donations
    .filter((d) => donationStatus(d) !== "EXPIRED")
    .reduce((sum, d) => sum + remainingKg(d), 0);

  return {
    listed,
    collected,
    missed,
    wasted,
    in_progress: inProgress,
    still_open: stillOpen,
    balanced:
      listed === collected + missed + wasted + inProgress + stillOpen,

    collected_by_donor: state.donors.map((donor) => ({
      donor_id: donor.id,
      name: donor.name,
      collected_kg: state.claims
        .filter(
          (c) =>
            c.status === "COLLECTED" &&
            donationFor(c.donation_id)?.donor_id === donor.id
        )
        .reduce((sum, c) => sum + c.kg, 0),
    })),

    volunteers: state.volunteers.map((volunteer) => ({
      volunteer_id: volunteer.id,
      name: volunteer.name,
      collected_kg: state.claims
        .filter(
          (c) =>
            c.volunteer_id === volunteer.id &&
            c.status === "COLLECTED"
        )
        .reduce((sum, c) => sum + c.kg, 0),

      missed_claims: state.claims.filter(
        (c) =>
          c.volunteer_id === volunteer.id &&
          c.status === "MISSED"
      ).length,
    })),
  };
}

// ---------- GET CURRENT APPLICATION STATE ----------

app.get("/api/state", async (req, res) => {
  await refreshMissedClaims();

  res.json({
    clock: state.clock,
    donors: state.donors,
    volunteers: state.volunteers,

    donations: state.donations.map((d) => ({
      ...d,
      zone: donorFor(d)?.zone,
      remaining_kg: remainingKg(d),
      status: donationStatus(d),
      claims: state.claims.filter(
        (c) => c.donation_id === d.id
      ),
    })),

    claims: state.claims,
    dashboard: dashboard(),
  });
});

// ---------- ADVANCE SIMULATED CLOCK ----------

app.post("/api/clock", async (req, res) => {
  const { clock } = req.body;

  if (typeof clock !== "string" || !Number.isFinite(timeMs(clock))) {
    return res.status(400).json({
      error: "Clock must be a valid time in YYYY-MM-DDTHH:MM format.",
    });
  }

  if (timeMs(clock) < nowMs()) {
    return res.status(400).json({
      error: "Clock cannot move backwards.",
    });
  }

  state.clock = clock;

  await save();
  await refreshMissedClaims();

  res.json({
    message: "Clock updated.",
    clock: state.clock,
  });
});

// ---------- POST A DONATION ----------

app.post("/api/donations", async (req, res) => {
  const {
    donor_id,
    description,
    quantity_kg,
    pickup_from,
    pickup_until,
  } = req.body;

  if (!state.donors.some((d) => d.id === donor_id)) {
    return res.status(400).json({
      error: "Choose a valid donor.",
    });
  }

  if (typeof description !== "string" || !description.trim()) {
    return res.status(400).json({
      error: "Description is required.",
    });
  }

  if (!validWholeKg(quantity_kg)) {
    return res.status(400).json({
      error: "Quantity must be a whole number of at least 1 kg.",
    });
  }

  if (
    !Number.isFinite(timeMs(pickup_from)) ||
    !Number.isFinite(timeMs(pickup_until))
  ) {
    return res.status(400).json({
      error: "Pickup times must be valid YYYY-MM-DDTHH:MM times.",
    });
  }

  if (timeMs(pickup_from) >= timeMs(pickup_until)) {
    return res.status(400).json({
      error: "Pickup start must be before pickup end.",
    });
  }

  if (timeMs(pickup_until) < nowMs()) {
    return res.status(400).json({
      error: "Pickup end cannot be before now.",
    });
  }

  const donation = {
    id: `DN${Date.now()}${Math.floor(Math.random() * 1000)}`,
    donor_id,
    description: description.trim(),
    quantity_kg,
    pickup_from,
    pickup_until,
  };

  state.donations.push(donation);
  await save();

  res.status(201).json({
    message: "Donation posted.",
    donation,
  });
});

// ---------- CANCEL A DONATION ----------

app.post("/api/donations/:id/cancel", async (req, res) => {
  const donation = donationFor(req.params.id);

  if (!donation) {
    return res.status(404).json({
      error: "Donation not found.",
    });
  }

  if (donationStatus(donation) !== "OPEN") {
    return res.status(400).json({
      error: "Only OPEN donations can be cancelled.",
    });
  }

  const hasActiveOrCollected = state.claims.some(
    (c) =>
      c.donation_id === donation.id &&
      (c.status === "ACTIVE" || c.status === "COLLECTED")
  );

  if (hasActiveOrCollected) {
    return res.status(400).json({
      error:
        "Donation cannot be cancelled while it has ACTIVE or COLLECTED claims.",
    });
  }

  donation.cancelled = true;
  await save();

  res.json({
    message: "Donation cancelled.",
  });
});

// ---------- RESERVE A DONATION ----------

app.post("/api/donations/:id/claims", async (req, res) => {
  await refreshMissedClaims();

  const donation = donationFor(req.params.id);
  const { volunteer_id, kg, planned_time } = req.body;
  const volunteer = volunteerFor(volunteer_id);

  if (!donation) {
    return res.status(404).json({
      error: "Donation not found.",
    });
  }

  if (!volunteer) {
    return res.status(400).json({
      error: "Choose a valid volunteer.",
    });
  }

  if (!validWholeKg(kg)) {
    return res.status(400).json({
      error: "Claim kg must be a whole number of at least 1.",
    });
  }

  if (!Number.isFinite(timeMs(planned_time))) {
    return res.status(400).json({
      error: "Planned pickup must be a valid YYYY-MM-DDTHH:MM time.",
    });
  }

  const errors = [];
  const donor = donorFor(donation);
  const status = donationStatus(donation);

  // Rule 1: Donation must be available.
  if (status === "CANCELLED") {
    errors.push("Rule 1: Donation is CANCELLED.");
  }

  if (status === "EXPIRED") {
    errors.push("Rule 1: Donation is EXPIRED.");
  }

  // Rule 2: Volunteer capacity.
  if (kg > volunteer.capacity_kg) {
    errors.push("Rule 2: Claim exceeds volunteer capacity.");
  }

  // Rule 3: Available food quantity.
  if (kg > remainingKg(donation)) {
    errors.push("Rule 3: Claim exceeds remaining donation kg.");
  }

  // Rule 4: Zone eligibility.
  if (!donor || !volunteer.zones.includes(donor.zone)) {
    errors.push("Rule 4: Volunteer does not serve this zone.");
  }

  // Rule 5: Pickup window.
  if (
    timeMs(planned_time) < timeMs(donation.pickup_from) ||
    timeMs(planned_time) > timeMs(donation.pickup_until)
  ) {
    errors.push(
      "Rule 5: Planned pickup must be inside the pickup window."
    );
  }

  // Rule 6: Pickup cannot be in the past.
  if (timeMs(planned_time) < nowMs()) {
    errors.push("Rule 6: Planned pickup cannot be before now.");
  }

  // Rule 7: At least 60 minutes between eligible claims.
  const conflictingClaim = state.claims.some(
    (c) =>
      c.volunteer_id === volunteer.id &&
      (c.status === "ACTIVE" || c.status === "COLLECTED") &&
      Math.abs(
        timeMs(planned_time) - timeMs(c.planned_time)
      ) < 60 * 60 * 1000
  );

  if (conflictingClaim) {
    errors.push(
      "Rule 7: Pickup must be at least 60 minutes from every other ACTIVE or COLLECTED claim."
    );
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: "Claim refused.",
      reasons: errors,
    });
  }

  const claim = {
    id: `CL${Date.now()}${Math.floor(Math.random() * 1000)}`,
    donation_id: donation.id,
    volunteer_id: volunteer.id,
    kg,
    planned_time,
    status: "ACTIVE",
  };

  state.claims.push(claim);
  await save();

  res.status(201).json({
    message: "Claim reserved.",
    claim,
  });
});

// ---------- MARK FOOD AS COLLECTED ----------

app.post("/api/claims/:id/collect", async (req, res) => {
  await refreshMissedClaims();

  const claim = state.claims.find(
    (c) => c.id === req.params.id
  );

  if (!claim) {
    return res.status(404).json({
      error: "Claim not found.",
    });
  }

  if (claim.status !== "ACTIVE") {
    return res.status(400).json({
      error: "Only ACTIVE claims can be collected.",
    });
  }

  const donation = donationFor(claim.donation_id);

  if (
    !donation ||
    nowMs() < timeMs(donation.pickup_from) ||
    nowMs() > timeMs(donation.pickup_until)
  ) {
    return res.status(400).json({
      error: "Collection is allowed only inside the pickup window.",
    });
  }

  claim.status = "COLLECTED";
  await save();

  res.json({
    message: "Food marked as collected.",
  });
});

// ---------- CANCEL A CLAIM ----------

app.post("/api/claims/:id/cancel", async (req, res) => {
  const claim = state.claims.find(
    (c) => c.id === req.params.id
  );

  if (!claim) {
    return res.status(404).json({
      error: "Claim not found.",
    });
  }

  if (claim.status !== "ACTIVE") {
    return res.status(400).json({
      error: "Only ACTIVE claims can be cancelled.",
    });
  }

  if (nowMs() >= timeMs(claim.planned_time)) {
    return res.status(400).json({
      error:
        "A claim can be cancelled only strictly before planned pickup.",
    });
  }

  claim.status = "CANCELLED";
  await save();

  res.json({
    message: "Claim cancelled and kilograms returned.",
  });
});

// ---------- FRONTEND SERVING ----------

app.use(express.static(DIST_DIR));

app.get("/", (req, res) => {
  const indexFile = path.join(DIST_DIR, "index.html");

  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }

  res.json({
    message: "SurplusLink backend is running",
    frontend: "http://localhost:5173",
    api: "http://localhost:3000/api/state",
  });
});

app.get("/{*path}", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      error: "API route not found.",
    });
  }

  const indexFile = path.join(DIST_DIR, "index.html");

  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }

  next();
});

// ---------- ERROR HANDLER ----------

app.use((err, req, res, next) => {
  console.error("Request failed:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: "Internal server error.",
    details:
      process.env.NODE_ENV === "production"
        ? undefined
        : err.message,
  });
});

// ---------- START ONLY AFTER DATABASE INITIALIZATION ----------

initializeState()
  .then(() => {
    app.listen(PORT, () => {
      console.log(
        `SurplusLink server running on http://localhost:${PORT}`
      );
    });
  })
  .catch((error) => {
    console.error("Failed to initialize SurplusLink:", error);
    process.exit(1);
  });


  
app.post("/api/reset", async (req, res) => {
  try {
    const freshState = JSON.parse(
      fs.readFileSync(SEED_FILE, "utf8")
    );

    if (!Array.isArray(freshState.claims)) {
      freshState.claims = [];
    }

    state = freshState;
    await save();

    res.json({
      message: "SurplusLink demo reset successfully.",
      clock: state.clock,
    });
  } catch (error) {
    console.error("Reset failed:", error);
    res.status(500).json({
      error: "Could not reset the demo.",
    });
  }
});
