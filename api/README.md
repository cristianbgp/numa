# numa api

Local Bun and Hono prototype for **How It Sounds**. It turns a short thought
into a canonical 12-second instrumental miniature with ElevenLabs Music and
reuses the local MP3 when the same normalized thought is requested again.

## Setup

Start your local PostgreSQL server first. With Postgres.app, create the empty
development and test databases once:

```sh
createdb numa
createdb numa_test
```

Postgres.app uses your macOS account as the local database user, so the
password-free development URL is `postgresql://localhost:5432/numa`.

```sh
cd api
bun install
cp .env.example .env
bun run db:migrate
```

Set `ELEVENLABS_API_KEY` and `OPENAI_API_KEY` in `.env`, then start the
development server. OpenAI's Moderation endpoint reviews every thought before
cache lookup or generation and is free for OpenAI API users.

```sh
bun run dev
```

The local endpoints are:

- Health: <http://localhost:3000/health>
- API docs: <http://localhost:3000/docs>
- OpenAPI: <http://localhost:3000/openapi.json>
- Public gallery: `GET /v1/how-it-sounds?limit=12`
- Public result: `GET /v1/how-it-sounds/:id`

## Generate audio

```sh
curl -X POST http://localhost:3000/v1/how-it-sounds \
  -H 'content-type: application/json' \
  -d '{"thought":"the room after everyone leaves"}'
```

The response contains an `audioUrl`. Repeating the same thought, including a
version with different repeated whitespace, returns the same ID with
`"cached": true` and does not call ElevenLabs again.

In local development, generated MP3s stay in `storage/`. Public thought
metadata and rate-limit counters live in PostgreSQL. Production stores MP3s
in Cloudflare R2 and uses Railway PostgreSQL, so the API itself is stateless.

## Public gallery

`GET /v1/how-it-sounds` lists public results from newest to oldest. The
default page size is 12 and the maximum is 24. When another page exists, pass
the returned opaque `nextCursor` back as the `cursor` query parameter:

```sh
curl 'http://localhost:3000/v1/how-it-sounds?limit=12&cursor=RETURNED_CURSOR'
```

The gallery reads PostgreSQL with stable keyset pagination. Existing local
JSON metadata files are intentionally ignored and preserved. If an existing
local MP3 matches a submitted thought, the API recreates its PostgreSQL record
without calling ElevenLabs.

## Public generation limits

New, uncached generations are protected by a persistent limiter. Cached
thoughts remain available without consuming generation quota. Defaults:

- one new generation per client every 10 minutes;
- three new generations per client each UTC day;
- twenty new generations globally each UTC day;
- one provider generation at a time.

The limiter state lives in PostgreSQL and stores only HMAC client identifiers,
never raw IP addresses. Configure it with `RATE_LIMIT_SECRET`,
`RATE_LIMIT_COOLDOWN_SECONDS`, `RATE_LIMIT_PER_IP_DAILY`,
`RATE_LIMIT_GLOBAL_DAILY`, and `RATE_LIMIT_CONCURRENCY`. Production should use
a dedicated, stable `RATE_LIMIT_SECRET`. The Bun server idle timeout defaults
to 120 seconds and can be changed with `SERVER_IDLE_TIMEOUT_SECONDS`.

## Public thought moderation

Every thought is reviewed before cache lookup, quota admission, metadata
storage, or ElevenLabs generation. OpenAI `omni-moderation-latest` blocks hate,
targeted harassment, threats, explicit sexual content, graphic violence,
violent wrongdoing, and self-harm content. Ordinary profanity and non-graphic
emotional references remain allowed. A local check also rejects email
addresses, URLs, and phone numbers because the gallery is public.

If moderation is unavailable, the API fails closed and asks the visitor to try
again later. Rejected thoughts are not stored and consume neither Numa quota
nor ElevenLabs credits.

## Verification

The default test suite is local and does not call ElevenLabs:

```sh
bun test
bun run typecheck
```

Database tests use the separate local `numa_test` database:

```sh
bun run test:db
```

The integration test below is intentionally opt-in. It performs one paid
ElevenLabs generation and then verifies that a second request uses the cache:

```sh
bun run test:integration
```

Do not automatically repeat a failed paid test. Inspect the error first to
avoid paying for duplicate generation attempts.

## Railway and R2 deployment

Create one Railway PostgreSQL service and one API service rooted at `api/`.
The API service does not need a persistent volume.

- Install/build: `bun install --frozen-lockfile`
- Pre-deploy: `bun run db:migrate`
- Start: `bun run start`
- Health check: `/health`

Configure the API service with:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
ELEVENLABS_API_KEY=...
OPENAI_API_KEY=...
AUDIO_STORAGE_DRIVER=r2
PUBLIC_BASE_URL=https://api.numa.channel
ALLOWED_ORIGIN=https://numa.channel
RATE_LIMIT_SECRET=<a long independent random value>
RATE_LIMIT_COOLDOWN_SECONDS=600
RATE_LIMIT_PER_IP_DAILY=3
RATE_LIMIT_GLOBAL_DAILY=20
RATE_LIMIT_CONCURRENCY=1
SERVER_IDLE_TIMEOUT_SECONDS=120
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=numa-sounds
R2_PUBLIC_BASE_URL=https://media.numa.channel
```

Create a Cloudflare R2 Standard bucket, attach the custom domain
`media.numa.channel`, and create a token restricted to object read/write for
that bucket. A suitable bucket CORS policy is:

```json
[
  {
    "AllowedOrigins": ["https://numa.channel"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range"],
    "ExposeHeaders": [
      "Content-Length",
      "Content-Range",
      "Accept-Ranges",
      "ETag"
    ],
    "MaxAgeSeconds": 86400
  }
]
```

Cloudflare Pages only needs `PUBLIC_API_URL` set to the Railway API origin.
Normal browser playback goes directly to R2 through the `audioUrl` returned by
the API.
