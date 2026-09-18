# Numa production deployment

Verified 2026-09-17 against the current repository and official Railway, Cloudflare, Astro, Bun, and Hono documentation.

## Target architecture

- `website/`: Astro 5 on Cloudflare Pages.
- `api/`: Bun + Hono on Railway.
- Railway PostgreSQL: public result metadata and persistent rate-limit state.
- Cloudflare R2: generated MP3 objects, read publicly through `media.numa.channel`.
- No Railway volume is needed with this architecture.

## 1. Cloudflare R2

Create the production bucket first so its credentials and public URL are available when the API is deployed.

1. Create a Standard R2 bucket, for example `numa-sounds`.
2. Connect `media.numa.channel` in **Bucket → Settings → Custom Domains** and wait for it to become Active. Keep the `r2.dev` development URL disabled in production. Cloudflare documents `r2.dev` as rate-limited and non-production; custom domains support cache and security controls. [Public R2 buckets and custom domains](https://developers.cloudflare.com/r2/buckets/public-buckets/)
3. Create an R2 API token with **Object Read & Write**, scoped only to this bucket. Copy both values immediately; the secret is shown once. [R2 API tokens](https://developers.cloudflare.com/r2/api/tokens/)
4. Set this bucket CORS policy:

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

The browser reads audio directly from the R2 custom domain, so R2 needs its own CORS policy independently of the API. Cloudflare requires the requesting origin, method, and request headers to be allowed; custom domains then emit the matching CORS response headers. Purge the hostname cache after changing an already-active CORS policy. [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/)

The S3-compatible endpoint is:

```text
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

Cloudflare's S3 guide specifies `region: "auto"`, the account endpoint, Access Key ID, and Secret Access Key. The current code constructs this endpoint from `R2_ACCOUNT_ID`, so it does not need a separate endpoint variable. [R2 S3 API](https://developers.cloudflare.com/r2/get-started/s3/)

## 2. Railway PostgreSQL and API

Create one Railway project with a PostgreSQL service and an API service connected to this GitHub repository.

### PostgreSQL

Add PostgreSQL from the Railway project canvas. Railway provides `DATABASE_URL` and keeps the database private by default. On the API service, create this reference variable:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

Replace `Postgres` if the database service has a different name. Use the private `DATABASE_URL`, not `DATABASE_PUBLIC_URL`; public database access is unnecessary and incurs network egress. [Railway PostgreSQL](https://docs.railway.com/databases/postgresql), [Railway reference variables](https://docs.railway.com/variables/reference)

### API service settings

| Railway setting | Value |
| --- | --- |
| Root directory | `/api` |
| Builder | Railpack |
| Build command | Leave unset |
| Pre-deploy command | `bun run db:migrate` |
| Start command | `bun run start` |
| Healthcheck path | `/health` |
| Volume | None |

The repository is an isolated monorepo, so Railway should build from `/api`. Railpack detects `bun.lock`, installs with Bun, and resolves the `start` script; because this package has no build script, no custom build command is required. [Railway monorepos](https://docs.railway.com/deployments/monorepo), [Railpack Bun/package-manager detection](https://railpack.com/languages/node)

The migration belongs in Railway's pre-deploy command: it runs after the image is built, inside the private network, with service variables available, and aborts deployment if it fails. [Railway pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command)

Railway injects `PORT`; do not set it manually. The current API reads it and Bun binds to `0.0.0.0` by default. Railway will query `/health` until it returns `2xx` before switching traffic. A Railway healthcheck only validates deployments; it is not continuous monitoring. [Railway healthchecks](https://docs.railway.com/deployments/healthchecks), [Bun server host and port](https://bun.sh/docs/runtime/http/server#changing-the-port-and-hostname)

### API variables

Set these on the API service (seal all secrets):

```dotenv
DATABASE_URL=${{Postgres.DATABASE_URL}}
ELEVENLABS_API_KEY=<secret>
OPENAI_API_KEY=<secret>

AUDIO_STORAGE_DRIVER=r2
R2_ACCOUNT_ID=<Cloudflare account ID>
R2_ACCESS_KEY_ID=<R2 token access key ID>
R2_SECRET_ACCESS_KEY=<R2 token secret access key>
R2_BUCKET=numa-sounds
R2_PUBLIC_BASE_URL=https://media.numa.channel

PUBLIC_BASE_URL=https://api.numa.channel
ALLOWED_ORIGIN=https://numa.channel

RATE_LIMIT_SECRET=<independent random secret>
RATE_LIMIT_COOLDOWN_SECONDS=600
RATE_LIMIT_PER_IP_DAILY=3
RATE_LIMIT_GLOBAL_DAILY=20
RATE_LIMIT_CONCURRENCY=1
SERVER_IDLE_TIMEOUT_SECONDS=120
```

`PUBLIC_BASE_URL` is the API's external origin; `R2_PUBLIC_BASE_URL` is the public object origin returned for audio. Neither should use a trailing path. Do not put ElevenLabs, OpenAI, database, rate-limit, or R2 credentials in Cloudflare Pages.

Generate a Railway public domain for the API, or configure `api.numa.channel`, then verify:

```text
https://api.numa.channel/health
https://api.numa.channel/openapi.json
```

Railway services are private until public networking is enabled. A Railway-provided domain is sufficient initially; a custom domain requires the CNAME and TXT records Railway supplies. [Railway public domains](https://docs.railway.com/networking/domains/working-with-domains)

## 3. Cloudflare Pages frontend

Configure the existing Pages project as follows:

| Pages setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `/website` |
| Framework preset | Astro |
| Build command | `bun install --frozen-lockfile && bun run build` |
| Build output directory | `dist` |
| Build system | V2 or newer |

Cloudflare requires an explicit root for a monorepo and documents `dist` as Astro's output. The repo contains `website/bun.lock`, so using `bun run build` keeps the package manager consistent. [Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [Cloudflare Pages Astro guide](https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/), [Pages monorepos](https://developers.cloudflare.com/pages/configuration/monorepos/)

Set this Pages build variable in Production:

```dotenv
PUBLIC_API_URL=https://api.numa.channel
SKIP_DEPENDENCY_INSTALL=1
```

Astro exposes `PUBLIC_` variables to browser code and statically replaces `import.meta.env` values at build time, so changing this value requires a new Pages build. [Astro environment variables](https://docs.astro.build/en/guides/environment-variables/)

To avoid the earlier asdf/tool-version failure, explicitly set the Pages build versions too:

```dotenv
NODE_VERSION=22.16.0
BUN_VERSION=1.4.2
```

Cloudflare Pages supports `NODE_VERSION` and `BUN_VERSION` overrides. [Pages build image](https://developers.cloudflare.com/pages/configuration/build-image/)

The current `website/wrangler.jsonc` is valid for the `numa` Pages project: it contains `name: "numa"`, `pages_build_output_dir: "./dist"`, and a compatibility date. A Pages Wrangler file requires `pages_build_output_dir`; once adopted it becomes the source of truth for overlapping configuration. [Pages Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)

Numa does not use Astro sessions. The project selects Astro's built-in
in-memory session driver because the installed Cloudflare adapter otherwise
defaults to a persistent `SESSION` KV binding. Production therefore does not
need that KV namespace or binding. Do not use Astro sessions for application
data without revisiting this configuration. The project also contains
`website/.node-version` so the Pages root selects Node 22.16.0 without relying
on repository-root tool configuration.

Keep the repository's pinned Astro 5 / `@astrojs/cloudflare` 12 versions while deploying to Pages. Astro removed Pages support from the newer Astro 6 adapter architecture; upgrading requires a deliberate migration to Cloudflare Workers. [Astro Cloudflare adapter migration note](https://docs.astro.build/en/guides/integrations-guide/cloudflare/#removed-cloudflare-pages-support)

## Cross-origin rules

There are two separate browser trust boundaries:

1. `numa.channel` → `api.numa.channel`: the API's `ALLOWED_ORIGIN` must exactly match the frontend origin. The current Hono middleware accepts one configured origin on `/v1/*`. Hono supports arrays or a callback if preview or `www` origins are needed later. [Hono CORS middleware](https://hono.dev/docs/middleware/builtin/cors)
2. `numa.channel` → `media.numa.channel`: the R2 bucket CORS policy above must allow the same frontend origin and audio request headers.

Cloudflare Pages preview URLs will not call the production API with the current single-origin API configuration. For previews, use a fixed preview origin/API environment or deliberately extend the API and R2 allowlists. Do not replace the API allowlist with `*` merely to make arbitrary previews work.

## Deployment order and smoke test

1. Push the reviewed code to the branch used for deployment.
2. Create R2 bucket → custom media domain → scoped token → CORS policy.
3. Create Railway Postgres.
4. Create Railway API from `/api`, add all variables, migration, start command, and healthcheck.
5. Enable the API public/custom domain; update `PUBLIC_BASE_URL` if its final origin changed and redeploy.
6. Confirm `/health` and that the migration completed.
7. Set Pages `PUBLIC_API_URL`, the tool versions, and the exact build settings; deploy the frontend.
8. Confirm `ALLOWED_ORIGIN` and the R2 `AllowedOrigins` exactly match the final frontend origin.
9. Perform one intentional paid generation. Confirm the result is stored in Postgres, its MP3 is in R2, playback/download work after refreshing the permanent result URL, and repeating the same normalized thought returns a cache hit rather than another provider call.

## Current readiness

The repository already contains the required production pieces: Postgres migrations, database-backed results and rate limiting, R2 S3 storage, explicit 120-second Bun idle timeout, `/health`, and Pages configuration. No Railway persistent volume should be attached. Remaining work is external service provisioning, secrets/domains/CORS configuration, deploying the reviewed code, and the final smoke test.
