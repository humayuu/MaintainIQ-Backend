# MaintainIQ Backend

MaintainIQ is a QR-based asset maintenance platform. This repository is its
backend: a **Node.js + Express + MongoDB** REST API.

Physical assets carry QR codes. Scanning a code opens the asset, where users can
report issues, run AI-assisted triage, and track maintenance history.

## Tech stack

- **Runtime:** Node.js (ES modules — `"type": "module"`)
- **Framework:** Express 5
- **Database:** MongoDB via Mongoose
- **Auth:** JSON Web Tokens (`jsonwebtoken`)
- **Config:** `dotenv`
- **Logging:** `morgan`
- **Dev:** `nodemon` (`npm start` runs `nodemon server.js`)

## Build phases

We build this backend in **6 phases**, in order:

1. **Project setup** — server bootstrap, Express app, config/env, MongoDB
   connection, base middleware and error handling.
2. **Models** — Mongoose schemas for the core domain (users, assets, issues,
   maintenance records, etc.).
3. **Auth** — user registration/login, JWT issuance, and auth middleware.
4. **Asset / QR** — asset CRUD and QR code generation/resolution (scanning a
   code resolves to an asset).
5. **Issue / AI triage** — issue reporting against assets and AI-assisted triage
   of reported issues.
6. **Maintenance / history** — maintenance actions and per-asset history/audit
   trail.

## Working agreement

- **One phase at a time.** We complete phases in the order above.
- **Each phase must be fully working and tested before moving to the next.** Do
  not start a later phase until the current one is verified end-to-end.
