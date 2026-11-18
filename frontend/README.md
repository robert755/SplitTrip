# SplitTrip frontend

The frontend is a Next.js App Router application built with TypeScript and Tailwind CSS. It includes an English, mobile-first landing page, login and registration pages, a trips dashboard, and a trip workspace for participants, expenses, and minimum-transfer settlement plans.

## Run locally

Start the backend first. In `backend/.env`, allow the frontend origin and set `PORT=3001`:

```dotenv
FRONTEND_ORIGINS="http://localhost:3000"
PORT=3001
```

In a terminal:

```powershell
cd backend
npm run start:dev
```

Then configure and start the frontend in a second terminal:

```powershell
cd frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The access token is kept in memory; the backend refresh token stays in its HttpOnly cookie. The dashboard refreshes the session when the app is opened again.

## Validate

```powershell
npm run lint
npm run build
```
