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

The access token is kept in memory; the backend refresh token stays in its HttpOnly cookie. The session is restored when the app opens, and an expired access token is refreshed and retried automatically.

For a Vercel deployment, set `NEXT_PUBLIC_API_URL=/api` and `API_PROXY_TARGET` to the backend's HTTPS origin. Next.js proxies `/api/*` to the backend so the browser uses a first-party refresh cookie. On the backend, set `REFRESH_TOKEN_COOKIE_PATH=/api/auth` and add the exact Vercel origin to `FRONTEND_ORIGINS`.

To deploy, import the repository into Vercel and set the project root directory to `frontend`. Deploy once to obtain the Vercel origin, configure the backend, then set the two frontend variables above in Vercel's Production environment and redeploy.

## Validate

```powershell
npm run lint
npm run build
```
