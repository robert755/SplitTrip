<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## API

- `GET /health` checks that the API is running.
- `POST /auth/register` creates an account using an email and a password of 12–128 characters.
- `POST /auth/login` authenticates an account.
- `POST /auth/refresh` rotates the HttpOnly refresh-token cookie and returns a new short-lived access token.
- `POST /auth/logout` revokes the refresh-token family and clears the cookie.
- `GET /trips` lists the authenticated user's trips.
- `POST /trips` creates a trip for the authenticated user with a JSON body such as `{ "name": "Via Ferrata" }`.
- `GET /trips/:tripId/participants` lists participants in a trip owned by the authenticated user.
- `POST /trips/:tripId/participants` adds a participant with a JSON body such as `{ "name": "Alex" }`.
- `GET /trips/:tripId/expenses` lists expenses in a trip owned by the authenticated user.
- `POST /trips/:tripId/expenses` adds an expense with a payer and custom participant shares.
- `GET /trips/:tripId/settlements` returns net balances and an exact minimum-transfer settlement plan.

Trips are stored in the configured PostgreSQL database through Prisma. Passwords are hashed with Argon2id. Refresh tokens are random, stored only as SHA-256 hashes, rotated on refresh, and revoked on logout or detected reuse. Access tokens expire after 15 minutes. Authentication endpoints are rate limited, and auth mutations are restricted to configured browser origins.

Copy `.env.example` to `.env`, generate a unique `JWT_ACCESS_SECRET` with at least 32 characters (for example, `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`), and set `FRONTEND_ORIGINS` to the exact origin of the frontend. In production, use HTTPS and configure the frontend and API on a shared site (for example, `app.example.com` and `api.example.com`) so browsers can reliably send the secure refresh cookie. Browser requests to the API must include credentials so the refresh cookie is sent. Email verification and password reset are not implemented yet.

After registering or logging in, send the returned access token as `Authorization: Bearer <accessToken>` to protected endpoints such as `/trips`. The refresh token is never returned in JSON; browsers keep it in the HttpOnly cookie.

For local frontend development, set `FRONTEND_ORIGINS="http://localhost:3000"` in `backend/.env`, set `PORT=3001`, and run `npm run start:dev`. The Next.js app uses `NEXT_PUBLIC_API_URL="http://localhost:3001"` from `frontend/.env.local`.

Expense amounts must be decimal strings with up to two fractional digits (for example, `"125.50"`). The API validates that each payer and share belongs to the trip, rejects duplicate participant shares, and checks that all shares sum exactly to the expense total.

Settlement plans minimize the number of transfers exactly for trips with up to 16 participants who have non-zero balances. A larger calculation returns `422` instead of silently switching to an approximate result.

## Database setup

Prisma is initialized for PostgreSQL with `Trip`, `Participant`, `Expense`, and `ExpenseShare` models. The participant count is derived from each trip's participants. Expense shares store each participant's custom amount; the application will validate that shares add up to the expense total. Expenses in a trip use its currency, which defaults to RON. Copy `.env.example` to `.env` and replace both placeholders with the connection strings from Supabase. `DATABASE_URL` uses the transaction-mode pooler (port `6543`) for the app, while `DIRECT_URL` uses the session-mode pooler (port `5432`) for Prisma CLI commands and migrations. Keep `.env` local and never commit it.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observer](https://observer.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
