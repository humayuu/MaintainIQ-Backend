# MaintainIQ — Backend

**MaintainIQ** is a QR-based asset maintenance platform. Physical assets carry QR
codes; scanning a code opens the asset, where users can report issues, run
AI-assisted triage, and track maintenance history.

This repository is the **backend**: a Node.js + Express + MongoDB REST API.

---

## Tech stack

| Layer     | Technology                       |
| --------- | -------------------------------- |
| Runtime   | Node.js (ES modules)             |
| Framework | Express 5                        |
| Database  | MongoDB (Mongoose)               |
| Auth      | JWT (`jsonwebtoken`) + bcrypt    |
| AI triage | Google Gemini (`@google/genai`)  |
| Security  | helmet, cors, express-rate-limit |
| QR codes  | `qrcode`                         |
| Dev       | nodemon, morgan                  |

---

## Getting started

### 1. Prerequisites

- Node.js 18+
- A MongoDB database (local or MongoDB Atlas)
- A Google Gemini API key (for AI triage)
- A Cloudinary account (for image/video evidence uploads) — optional; without it
  the app runs fine and upload endpoints return a clean 503

### 2. Install

```bash
git clone <repo-url>
cd maintainiq-backend
npm install
```

### 3. Configure environment

Copy the example env file and fill in your own values:

```bash
cp .env.example .env
```

`.env` variables:

```env
PORT=8080
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

MONGODB_URI=<your-mongodb-connection-string>
JWT_SECRET=<a-long-random-string>
JWT_EXPIRES_IN=24h

GEMINI_API_KEY=<your-gemini-api-key>

# Optional — for image/video evidence uploads
CLOUDINARY_CLOUD_NAME=<your-cloudinary-cloud-name>
CLOUDINARY_API_KEY=<your-cloudinary-api-key>
CLOUDINARY_API_SECRET=<your-cloudinary-api-secret>
```

> ⚠️ **Never commit `.env`.** It is already listed in `.gitignore`. It contains
> database credentials and API keys.

The database name is set to **`maintainiq_db`** in `src/config/db.js`.

### 4. Run

```bash
npm run dev     # nodemon (auto-reload)  — development
npm start       # node server.js          — production
npm run seed    # wipe + load demo users, assets, issues & history
```

Server starts on `http://localhost:8080`. Health check: `GET /api/health`.

---

## Demo credentials

Run `npm run seed` once to create these accounts (plus 5 sample assets, 3 issues,
a maintenance record, and history). The seed **wipes** existing data and refuses
to run against `NODE_ENV=production` unless `SEED_FORCE=true`.

| Role       | Email                       | Password    |
| ---------- | --------------------------- | ----------- |
| Admin      | `admin@maintainiq.com`      | `Admin@123` |
| Technician | `tech@maintainiq.com`       | `Tech@123`  |
| Supervisor | `supervisor@maintainiq.com` | `Super@123` |

> ⚠️ **Dev/demo only.** These are seeded on a development database. Do **not**
> reuse these credentials in production, and change them before any public
> deployment.

Log in via `POST /api/auth/login` — the response contains a JWT `token`. Send it
on protected routes as:

```
Authorization: Bearer <token>
```

---

## API reference

Base URL: `http://localhost:8080/api`

### Auth

| Method | Endpoint         | Auth  | Body                              |
| ------ | ---------------- | ----- | --------------------------------- |
| POST   | `/auth/register` | —     | `{ name, email, password, role }` |
| POST   | `/auth/login`    | —     | `{ email, password }`             |
| GET    | `/auth/me`       | token | —                                 |

`role` ∈ `admin` \| `technician` \| `supervisor`

### Users _(admin only)_

| Method | Endpoint                 | Auth  | Notes                                  |
| ------ | ------------------------ | ----- | -------------------------------------- |
| GET    | `/users?role=technician` | admin | list users (used by the assign picker) |

### Assets _(all require a token)_

| Method | Endpoint              | Auth  | Notes                                          |
| ------ | --------------------- | ----- | ---------------------------------------------- |
| POST   | `/assets`             | admin | `{ name, assetCode, category, location, ... }` |
| GET    | `/assets`             | any   | paginated list (`?page=&limit=&search=`)       |
| GET    | `/assets/stats`       | any   | totals + counts by status                      |
| GET    | `/assets/:id`         | any   | single asset                                   |
| PUT    | `/assets/:id`         | admin | update fields                                  |
| GET    | `/assets/:id/qr`      | any   | QR code (data URL)                             |
| GET    | `/assets/:id/label`   | any   | printable label                                |
| GET    | `/assets/:id/history` | any   | append-only audit trail                        |

### Issues _(all require a token)_

| Method | Endpoint                  | Auth                | Body                          |
| ------ | ------------------------- | ------------------- | ----------------------------- |
| GET    | `/issues`                 | any                 | list (`?status=&priority=`)   |
| GET    | `/issues/stats`           | any                 | totals, open, critical, by status/priority |
| GET    | `/issues/:id`             | any                 | single issue + its maintenance records |
| PUT    | `/issues/:id/assign`      | admin               | `{ technicianId }`            |
| POST   | `/issues/:id/maintenance` | assigned tech/admin | maintenance record fields     |
| PUT    | `/issues/:id/status`      | assigned tech/admin | `{ status, criticalSafety? }` |
| PUT    | `/issues/:id/reopen`      | assigned tech/admin | —                             |

### Uploads _(evidence media → Cloudinary)_

Send `multipart/form-data` with one or more `files` (images/videos, ≤ 15 MB
each, ≤ 5 files). Responds with `{ data: { urls: [...] } }` — store those URLs on
the issue's / maintenance record's `evidence` array. Returns **503** when
Cloudinary is not configured (the rest of the API keeps working).

| Method | Endpoint          | Auth  | Notes                                            |
| ------ | ----------------- | ----- | ------------------------------------------------ |
| POST   | `/uploads`        | token | technician/admin maintenance evidence            |
| POST   | `/public/uploads` | —     | public issue-report evidence (rate-limited)      |

**Issue status flow:**
`Reported → Assigned → Inspection Started → Maintenance In Progress → Resolved → Closed`
(`Maintenance In Progress ⇄ Waiting for Parts`; `Resolved/Closed → Reopened → Assigned`).
An issue cannot be `Resolved` without at least one maintenance record.

### Public _(no auth — QR scan flow, rate-limited 10 req / 15 min)_

| Method | Endpoint                             | Body                                                                            |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------- |
| GET    | `/public/assets/:slug`               | resolve a scanned QR to its asset                                               |
| POST   | `/public/assets/:slug/issues/triage` | `{ complaint }` → AI suggestion (saves nothing)                                 |
| POST   | `/public/assets/:slug/issues`        | `{ title, description, category?, priority?, reporterName?, reporterContact?, evidence? }` |
| POST   | `/public/uploads`                    | `multipart/form-data` `files` → `{ urls: [...] }` (rate-limited)                 |

### Health

| Method | Endpoint  | Auth |
| ------ | --------- | ---- |
| GET    | `/health` | —    |

---

## Project structure

```
src/
├── app.js               # Express app (middleware, routes, error handler)
├── config/db.js         # MongoDB connection
├── controllers/         # Request handlers
├── models/              # Mongoose schemas (User, Asset, Issue, ...)
├── routes/              # Route definitions (mounted under /api)
├── middleware/          # auth, role, ownership, rate limiter
├── services/            # auth, AI triage, history, status transitions
└── utils/               # jwt, qr, asyncHandler
server.js                # Boot: connect DB, then listen
```
