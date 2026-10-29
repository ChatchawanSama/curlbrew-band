# curlbrew.

Can U Remember Lyrics? A private rehearsal companion for a casual band: searchable songs, chord references, rehearsal collections, and a focused practice view.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app requires a configured Neon database and Better Auth secret. Empty libraries and sessions render intentional empty states; no sample records are bundled.

## Production setup

1. Create a Neon PostgreSQL project and set `DATABASE_URL` in Vercel Environment Variables.
2. Generate a secret with `openssl rand -base64 32` and set `BETTER_AUTH_SECRET`. Set `BETTER_AUTH_URL` to the deployed URL.
3. Run `npm run db:generate` after schema changes, review the SQL in `drizzle/`, then run `npm run db:migrate` against the target database.
4. Bootstrap the first admin through a one-time protected operational script using Better Auth's admin API, then provision members out-of-band. Keep registration disabled; the official username plugin is configured as immutable and the admin plugin is enabled.
5. Configure the server-only Neon S3-compatible Object Storage values using `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, and `S3_BUCKET`. The authenticated `/api/uploads/chord-sheet` route validates JPG/PNG/WebP metadata, limits pages to 10 MB, generates safe object keys, and returns a five-minute presigned upload URL. The client must PUT the file to that URL, then persist the returned object key/page metadata in `chord_image_pages`. Delete the object only after its database row is deleted successfully.
6. Deploy to Vercel. Do not prefix database, auth, or storage secrets with `NEXT_PUBLIC_`.

## curlbrew admin access

Session creation, rename, and deletion use the small server-only admin login. Set `CURLBREW_ADMIN_USERNAME`, `CURLBREW_ADMIN_PASSWORD`, and a random `CURLBREW_SESSION_SECRET` (at least 32 characters) in `.env.local` for local work and in Vercel Environment Variables for production. The admin session is a signed, HttpOnly cookie valid for seven days, with `Secure` enabled in production. Credentials are never returned by an API or stored in browser storage. Login attempts are throttled in process; on serverless deployments this is intentionally lightweight and is not a substitute for a shared rate-limit service.

The public session list remains readable. The session room's existing management-link key continues to authorize queue operations, while the admin cookie protects session lifecycle changes. Use the Admin logout action in the Sessions sidebar to clear the cookie.

## Authentication note

Better Auth's username plugin still requires the underlying user record's email field. Use a synthetic internal email for username-only members (for example, `alex@members.internal`) and do not expose email collection in the UI. The current auth config disables public sign-up and enables email/password plus the official username plugin.

## Verification

```bash
npm run typecheck
npm run build
```

The database/auth/live control adapters are separated in `src/db`, `src/lib/auth.ts`, `src/lib/server-auth.ts`, and `src/app/api/live`. Queue transitions run in a Drizzle transaction and lock the session row before changing state.

Serverless rate limiting: the current route enforces duplicate pending requests, but a production deployment should add an edge-compatible rate limiter (or Vercel/Neon-supported request limit) keyed by session code plus a hashed IP before exposing the public endpoint. Do not use an in-memory limiter as a security boundary across serverless instances.

Backup: use Neon’s dashboard/database branching or `pg_dump` against `DATABASE_URL` for periodic exports, and use `/api/export` for a portable song-library JSON backup. No scheduled keep-alive or worker is required.
