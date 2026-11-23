# SplitTrip

SplitTrip is a full-stack web application for tracking shared trip expenses and calculating the minimum number of payments needed to settle the group.

It is built for the situations that usually end in spreadsheets or confusing group-chat follow-ups: a cabin booking paid by one person, fuel paid by another, groceries split unevenly, and several friends wanting to settle their balances as quickly as possible.

**Project goal:** remove manual calculations and ambiguity from group expenses while providing account isolation, exact monetary arithmetic, settlement history, and clear payment tracking.

## Table of Contents

- [Live Demo](#live-demo)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Minimum-Transfer Algorithm](#minimum-transfer-algorithm)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Database Design](#database-design)
- [API Overview](#api-overview)
- [Authentication and Security](#authentication-and-security)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project Limitations](#project-limitations)
- [Possible Improvements](#possible-improvements)

## Live Demo

Demo URLs are intentionally not included until the frontend and API are deployed and verified.

<!--
After deployment, add the production URLs:
- Frontend: https://your-project.vercel.app
- API health: https://your-api.onrender.com/health
-->

## Key Features

- User registration and login
- Session restoration and automatic access-token refresh
- Trip ownership and authorization
- Participant management
- Expense creation and editing
- Custom expense-share amounts
- Exact validation that all participant shares equal the expense total
- Exact net-balance calculation in cents
- Minimum-transfer settlement plans
- Settlement plan versioning and history
- Outdated-plan invalidation after expense or participant changes
- Paid/unpaid status for individual transfers
- Hourly cleanup of demo trips older than 24 hours
- Mobile-first responsive interface
- Rate limiting and browser-origin protection
- Health check endpoint for deployment monitoring

## How It Works

1. A user creates an account and signs in.
2. The user creates a trip and adds participants.
3. Every expense records:
   - who paid;
   - the expense description;
   - the total amount;
   - how much each participant owes.
4. SplitTrip calculates each participant's net balance:
   - positive balance: the participant is owed money;
   - negative balance: the participant owes money;
   - zero balance: the participant is already settled.
5. The settlement endpoint calculates a transfer plan that balances all participants.
6. The plan is saved with its individual balances and transfers.
7. The user can mark transfers as paid or unpaid.

If a participant or expense changes, the active settlement plan is invalidated. A recalculation creates a new plan revision instead of overwriting the previous one.

## Minimum-Transfer Algorithm

The settlement calculation is implemented in [`backend/src/settlements/minimum-transfers.ts`](backend/src/settlements/minimum-transfers.ts).

### 1. Convert currency values to cents

All monetary values are converted to integer cents before settlement calculations. This avoids binary floating-point rounding errors and keeps calculations deterministic.

For example:

- `125.50` becomes `12550` cents;
- `-20.25` becomes `-2025` cents;
- a debt and a credit are compared only as exact integers.

The database stores expenses, shares, balances, and transfers with decimal precision, and the service converts them to and from cents.

### 2. Calculate net balances

For each expense:

- the payer receives a positive balance equal to the full expense amount;
- every participating share receives a negative balance for their part of the expense.

For an expense of `100 RON` paid by Alex and split equally between Alex and Jamie:

```text
Alex:  +100 - 50 = +50
Jamie:   0 - 50 = -50
```

The sum of all net balances must equal zero.

### 3. Remove zero balances

Participants whose net balance is `0` do not appear in the settlement plan. This reduces unnecessary states and transfers.

### 4. Search zero-sum subsets

The algorithm supports exact settlement for up to 16 participants with non-zero balances.

It uses bitmasks to calculate the sum of every subset of participant balances:

```text
subsetSums[mask] = subsetSums[mask without lowest bit]
                  + balances[index]
```

A subset is balanced when its total is zero. The algorithm then uses dynamic programming to partition the complete set of non-zero balances into the minimum number of balanced groups.

This is especially useful for groups with independent zero-sum components. For example:

```text
Alex +100, Jamie -100
Maya +50, Sam -50
```

The result is two balanced groups and therefore two transfers rather than unnecessary cross-group settlements.

### 5. Create the transfers

Inside each balanced group, the implementation matches:

- every debtor: negative net balance;
- every creditor: positive net balance.

It calculates the next transfer as the smaller of the current debtor or creditor amount, adds that transfer to the plan, then adjusts both balances.

The algorithm continues until the group is settled.

### 6. Reject oversized exact calculations

An exact calculation is limited to 16 non-zero balances because the subset dynamic programming uses a `2^n` state space.

If a trip exceeds this limit, the API returns `422 Unprocessable Entity` instead of silently returning an approximate or misleading settlement plan.

### Example

```text
Alex   balance: +100
Jamie  balance:  -30
Sam    balance:  -70
```

The result contains two transfers:

```text
Jamie  -> Alex: 30
Sam    -> Alex: 70
```

The total transferred is 100, and every participant ends at zero.

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- App Router
- Next.js server-side rewrites for same-origin API proxying
- Fetch API
- React Context for authentication state

### Backend

- NestJS 12
- TypeScript
- Prisma ORM 7
- PostgreSQL
- Prisma transaction isolation
- Argon2id password hashing
- JWT access tokens
- SHA-256 refresh-token hashes
- HttpOnly cookies
- NestJS validation, throttling, scheduling, and CORS configuration
- Vitest
- Oxlint

### Infrastructure

- Vercel for the Next.js frontend
- Render Blueprint for the NestJS API
- Supabase for PostgreSQL
- GitHub for source control

## Architecture

```text
Browser
  |
  | /api/*
  v
Next.js frontend
  |
  | server-side rewrite
  v
NestJS REST API
  |
  | Prisma
  v
PostgreSQL
```

In production, the frontend can expose `/api/*` as a same-origin proxy to the backend. This avoids exposing a separate API origin to the browser and makes the refresh cookie a first-party cookie.

The frontend stores only short-lived access tokens in memory. The refresh token is stored in an HttpOnly cookie and is never returned in JSON.

### Backend modules

- **Auth:** registration, login, refresh, logout, refresh-session rotation
- **Trips:** trip ownership and trip lifecycle
- **Participants:** participant creation and removal
- **Expenses:** expense and share validation, creation, update, and listing
- **Settlements:** balance calculation, plan storage, settlement history, payment status
- **Prisma:** database access and transactions

## Database Design

The Prisma schema includes:

- `User`
- `RefreshSession`
- `Trip`
- `Participant`
- `Expense`
- `ExpenseShare`
- `SettlementPlan`
- `SettlementBalance`
- `SettlementTransfer`

Important design decisions:

- Trips belong to a user through `ownerId`.
- Participant and expense records belong to a trip.
- Expense shares use a unique constraint on `(expenseId, participantId)`.
- Settlement plans have revision numbers per trip.
- Only one settlement plan can be current for a trip.
- Changing participants or expenses invalidates the current plan.
- Payment status can change only on the current plan.
- Previous balances and transfers remain available for history.
- Trip deletion cascades through dependent settlement data.

## API Overview

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | API health check |
| `POST` | `/auth/register` | Create an account |
| `POST` | `/auth/login` | Authenticate a user |
| `POST` | `/auth/refresh` | Rotate the refresh session |
| `POST` | `/auth/logout` | Revoke the refresh session |
| `GET` | `/trips` | List the authenticated user's trips |
| `POST` | `/trips` | Create a trip |
| `DELETE` | `/trips/:tripId` | Delete a trip |
| `GET` | `/trips/:tripId/participants` | List participants |
| `POST` | `/trips/:tripId/participants` | Add a participant |
| `DELETE` | `/trips/:tripId/participants/:participantId` | Remove a participant |
| `GET` | `/trips/:tripId/expenses` | List expenses |
| `POST` | `/trips/:tripId/expenses` | Add an expense |
| `PATCH` | `/trips/:tripId/expenses/:expenseId` | Update an expense |
| `GET` | `/trips/:tripId/settlements` | Retrieve the latest plan |
| `POST` | `/trips/:tripId/settlements` | Calculate and save a plan |
| `PATCH` | `/trips/:tripId/settlements/:transferId` | Mark a transfer paid or unpaid |

Protected endpoints require:

```http
Authorization: Bearer <accessToken>
```

## Authentication and Security

### Password storage

Passwords are hashed with Argon2id. Plain-text passwords are never persisted.

### Access tokens

- Signed JWT access tokens expire after 15 minutes.
- Access tokens are sent using the `Authorization: Bearer` header.
- Access tokens remain only in frontend memory.

### Refresh tokens

- Refresh tokens are random 32-byte base64url values.
- Only their SHA-256 hashes are stored in PostgreSQL.
- Refresh tokens use 30-day expiry.
- Refreshes rotate the token and revoke the previous session.
- Logout revokes the refresh-session family.
- The token is sent in an HttpOnly, SameSite=Lax cookie.

### Browser protection

- Production CORS is restricted to explicitly configured origins.
- Authentication mutations reject untrusted browser origins.
- Requests are validated and unknown fields are rejected.
- Authentication endpoints and settlement calculation are throttled.
- Protected resources verify trip ownership.

### Monetary integrity

- Expense amounts use decimal strings with at most two decimal places.
- Settlement calculations use `bigint` cents.
- Payers and shares must belong to the trip.
- Duplicate participant shares are rejected.
- The sum of shares must exactly equal the expense total.
- Settlement calculation uses database transactions and serializable isolation where appropriate.

## Getting Started

### Prerequisites

- Node.js 24 or a compatible current LTS release
- npm
- PostgreSQL or a hosted PostgreSQL provider
- Supabase-compatible connection strings for the recommended setup

### 1. Clone the repository

```bash
git clone https://github.com/robert755/SplitTrip.git
cd SplitTrip
```

### 2. Configure the backend

```bash
cd backend
cp .env.example .env
npm install
```

Populate `backend/.env` with the database URLs and a unique access-token secret.

Generate a secure secret:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Apply migrations and start the API:

```bash
npx prisma migrate deploy
npm run start:dev
```

The API listens on `http://localhost:3001` when `PORT=3001` is configured.

### 3. Configure the frontend

Open a second terminal:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

For local development, use:

```dotenv
# backend/.env
FRONTEND_ORIGINS="http://localhost:3000"
REFRESH_TOKEN_COOKIE_PATH="/auth"
PORT=3001

# frontend/.env.local
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

## Environment Variables

### Backend

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL transaction/pooling connection string |
| `DIRECT_URL` | PostgreSQL direct/session connection for Prisma CLI operations |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens; at least 32 characters |
| `FRONTEND_ORIGINS` | Comma-separated exact browser origins |
| `REFRESH_TOKEN_COOKIE_PATH` | Cookie path, such as `/auth` locally or `/api/auth` behind the proxy |
| `PORT` | API listening port |
| `NODE_ENV` | `development` or `production` |

Never commit `.env`, `.env.local`, or files containing real credentials.

### Frontend

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | API base URL; use `/api` in production |
| `API_PROXY_TARGET` | Server-only HTTPS backend URL used by Next.js rewrites |

In production:

```dotenv
NEXT_PUBLIC_API_URL="/api"
API_PROXY_TARGET="https://your-api-host.example"
```

## Testing

The backend includes unit, service, and end-to-end-oriented Vitest suites.

Run backend tests:

```bash
cd backend
npm run test
npm run test:e2e
```

Run a coverage report:

```bash
npm run test:cov
```

Run lint and build checks:

```bash
npm run lint
npm run build
```

Run frontend checks:

```bash
cd frontend
npm run lint
npm run build
```

## Deployment

The repository includes [`render.yaml`](render.yaml) for deploying the backend on Render.

### Backend on Render

1. Create a Vercel project or otherwise know the exact frontend origin.
2. Create a Render Blueprint from this repository.
3. Set these Render environment variables:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `JWT_ACCESS_SECRET`
   - `FRONTEND_ORIGINS`
4. Keep `NODE_ENV=production`.
5. Keep `REFRESH_TOKEN_COOKIE_PATH=/api/auth` when using the Next.js `/api` proxy.
6. Render runs Prisma migrations and builds the NestJS application during deployment.

### Frontend on Vercel

1. Import the GitHub repository.
2. Set the Vercel root directory to `frontend`.
3. Deploy once to obtain the exact production origin.
4. Configure `FRONTEND_ORIGINS` on the backend with that origin.
5. Set:

```dotenv
NEXT_PUBLIC_API_URL="/api"
API_PROXY_TARGET="https://your-render-api-host.example"
```

6. Redeploy the frontend.

Do not place database passwords or JWT secrets in `NEXT_PUBLIC_*` variables. Variables prefixed with `NEXT_PUBLIC_` are exposed to browsers.

## Project Limitations

- The demo currently presents RON as the default currency.
- The exact settlement limit is 16 participants with non-zero balances.
- Email verification is not implemented.
- Password-reset functionality is not implemented.
- No external payment or bank integration is included.
- Manual transfer status is not proof that money was sent through a bank.
- Demo trips older than 24 hours are deleted automatically.
- A public repository does not expose local `.env` files or hosting-platform secrets.

## Possible Improvements

- Add automated screenshot or Playwright end-to-end tests.
- Add email verification and password recovery.
- Support and persist selected currencies.
- Add per-trip invite links or shareable read-only views.
- Add charts for spending by participant or category.
- Add expense categories and optional receipts.
- Add Web Push or email reminders for unpaid transfers.
- Add export to CSV or PDF.
- Increase automated API and frontend test coverage.
- Add observability and structured application logs.
- Add soft deletion and longer-term trip retention.
