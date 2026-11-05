<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": true` in the root `turbo.json` or `turbo.jsonc` to opt in; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# Allowkazam

Turborepo monorepo (pnpm workspaces).

- `apps/` — applications (one folder per app, each with its own `package.json`)
- `packages/` — shared packages (`@repo/eslint-config`, `@repo/typescript-config`)
- Run tasks from the repo root with `pnpm turbo run <task>`; use `--filter=<app>` for one app.

## Learning commands

Tutor-style behaviour applies only when a learning command (`/learn`, `/hint`, `/debug`, ...) is invoked. Outside those commands, work normally.

# Developer API Gateway (V1)

A small developer platform in front of an existing API. Customers register an upstream API, get a proxied URL and API keys; the gateway handles **access, rate limiting and request logging**. Portfolio project, must be interview-ready: deployed, documented, with self-measured numbers.

- Plan: https://app.notion.com/p/Plan-3e55a925252380a1998aca51bb0953cc
- **Step-by-step build guide (source of truth for what to build and in what order)**: https://app.notion.com/p/40e5a925252381bead1fedb9213005aa — Steps 0–21. Fetch it with the Notion MCP when a task refers to a step; it is large, so search within the saved result instead of reading it whole.

## How we work

- The user builds by following the guide, one step (or part of a step) at a time, in order. Don't start the next step until the current step's "Done when" is true.
- **Before writing any code for a task, post a short plan**: which guide step it maps to, what you will build, which files/packages are touched, how (approach, key decisions), and how it will be verified. Wait for the user's go-ahead, then implement.
- Stay inside the task. Anything outside the V1 scope below is not built.
- New env var → add it in three places: the Zod schema in `apps/gateway/src/config.ts`, `apps/gateway/.env.example`, and `.env`.
- Install packages into the package that uses them (`pnpm --filter @gw/gateway add ...`), not the root; only shared dev tools (TypeScript, ESLint, Prettier, Vitest, Turborepo) go in the root.
- Commit at the end of every step (suggested message is in the guide).
- **Keep `README.md` up to date as part of every task**; the user should never have to update it by hand. When a task changes what exists or how to run it, update the README in the same change: what has been built so far (steps completed), current features, how to run/test it locally, env variables, endpoints, and architecture notes. Describe only what actually exists; no placeholder or future-feature text, and no made-up metrics. Mention the README update in your end-of-task summary.
- Never invent benchmark numbers; only use ones measured with k6.

## Fixed decisions

- Forwarding uses `undici.request` directly (not `fetch`, not `@fastify/reply-from`): full control of DNS + IP pinning, no automatic decompression or header changes.
- ESM everywhere: `"type": "module"`, TS `module`/`moduleResolution` = `NodeNext`; relative imports need the `.js` extension (`./config.js`).
- Package names: `@gw/gateway`, `@gw/dashboard`, `@gw/shared`, `@gw/config`, `@gw/dummy-upstream`. Exactly one Zod version in the repo.
- Apps: `apps/gateway`, `apps/dashboard`, `apps/dummy-upstream` (test upstream reused by manual tests, automated tests, k6). Ports: gateway 3000, dashboard 3001, dummy upstream 4000.
- `.env` lives in `apps/gateway/` (with `.env.example`). Dashboard uses `apps/dashboard/.env.local` (`GATEWAY_URL`).
- IDs are UUIDs (`@default(uuid())`). Passwords hashed with argon2id.
- Redis key cache TTL: 5 min for valid keys, 30 s for unknown keys. Revocation deletes the cache entry.
- Redis down → rate limiting fails open with a warning log (`RATE_LIMIT_FAIL_MODE`), documented in an ADR.
- Admin sessions: signed cookie (`@fastify/secure-session`), no session table. CSRF: check `Origin` header on admin POST/PATCH/DELETE.
- Dashboard reaches the admin API through Next.js rewrites of `/api/*` to the gateway (same origin, no CORS).
- Key limits are not editable: create a new key and revoke the old one.
- Log retention 7 days, cleanup once a day.

## Architecture

- **Data plane** (`/p/{projectSlug}/...`): live proxy traffic. Must stay fast.
- **Control plane** (`/admin/...`): CRUD for projects, keys, logs. Correctness over speed.
- Both live in one Fastify app (`apps/gateway`) as two route groups.
- Dashboard is a small Next.js app (`apps/dashboard`) talking to the admin API.
- Shared Zod schemas/types/constants go in `packages/shared`.
- Proxy routes are mounted so that project lookup and key auth happen before the rate limiter (see hook order below).

Request flow: client → API key check (Redis cache, Postgres on miss) → 401 if invalid/revoked → Redis Lua token bucket → 429 + `Retry-After` if empty → SSRF check on upstream → stream to upstream (undici) → stream response back → push log record to in-memory buffer → batch flush to Postgres.

## Stack

TypeScript (Node 22), Fastify, undici, Zod, PostgreSQL + Prisma, Redis (`ioredis` + Lua), Next.js + Tailwind (dashboard), pino JSON logs, Vitest + Fastify `inject` + Testcontainers, k6, Docker Compose (app + Postgres + Redis), GitHub Actions CI, Railway or Fly.io deploy, OpenAPI via `@fastify/swagger`.

## Data model

- **users**: id, email, password_hash, created_at (single admin)
- **projects**: id, name, slug (unique), upstream_url, default_rpm, default_burst, created_at
- **api_keys**: id, project_id, name, key_prefix, key_hash (SHA-256), rpm, burst, revoked_at, last_used_at, created_at
- **request_logs**: id, project_id, api_key_id, method, path, status, latency_ms, upstream_latency_ms, request_bytes, response_bytes, request_id, created_at. Index `(project_id, created_at desc, id desc)`; keep 7 days (cleanup job).

## Requirements

**Projects**: create/list/edit/delete with name, slug, upstream URL. Creating one yields a working `/p/{slug}` proxy URL.

**API keys**: format `gw_live_<32 random bytes, base64url>`. Show the full key once; store only prefix + SHA-256 hash. Revoke deletes the Redis cache entry; a revoked key returns 401 within 1 second. Accepted via `Authorization: Bearer` or `x-api-key`.

**Proxy**: forward method, path, query, body, safe headers. Strip hop-by-hop headers and the gateway API key. Add `X-Request-Id` and `X-Forwarded-For`. Stream everything (never buffer whole bodies). Timeouts: connect 3s, total 30s (configurable). `502` bad upstream response, `504` upstream timeout. Must work for GET/POST/PUT/DELETE and large bodies.

**Rate limiting**: token bucket in Redis, atomic via Lua (use Redis `TIME`, not app clocks). Per key `rpm` (refill) and `burst` (capacity). Return `429` + `Retry-After`, plus `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. Fail-open vs fail-closed on Redis outage is decided in an ADR. 1000 parallel requests against a limit of 100 must allow exactly 100 (+ refill).

**SSRF protection (mandatory)**: only `http`/`https`; ports 80/443 or an allow-list. Resolve DNS ourselves, block private/reserved ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, `fc00::/7`, `fe80::/10`), and connect to the pinned resolved IP (stops DNS rebinding). Don't follow redirects blindly (re-validate each hop or disable). Cap response size and total time. Tests for every blocked range, a rebinding case, and odd encodings like `0x7f000001`.

**Request logs**: record endpoint, status, latency, key, timestamp, bytes. Buffered batch insert (flush ~1s or 500 records). Never block a response on a DB write.

**Dashboard**: single-admin login (argon2/bcrypt, httpOnly session cookie, CSRF protection), projects list + create, API keys create (show once) + revoke, recent logs table with filters (status, key, time) and cursor pagination.

**Operations**: `/healthz` and `/readyz`, structured JSON logs with request IDs, graceful shutdown (drain in-flight requests, flush log buffer), env-based config, no secrets in git.

## Endpoints

`GET /healthz` (200), `GET /readyz` (200/503, DB + Redis), `POST /admin/auth/login|logout`, `GET /admin/auth/me`, `GET|POST /admin/projects`, `GET|PATCH|DELETE /admin/projects/:id` (delete removes keys, logs, caches), `GET|POST /admin/projects/:id/keys`, `POST /admin/keys/:keyId/revoke`, `GET /admin/projects/:id/logs` (filters + cursor), `ANY /p/:slug/*` (proxy).

## Env variables

`NODE_ENV`, `PORT`, `LOG_LEVEL`, `BASE_URL`, `DATABASE_URL`, `REDIS_URL`, `ADMIN_EMAIL`/`ADMIN_PASSWORD` (seed only), `SESSION_SECRET`, `DASHBOARD_ORIGIN`, `KEY_CACHE_TTL_SECONDS`, `RATE_LIMIT_FAIL_MODE` (open/closed), `ALLOWED_UPSTREAM_PORTS`, `SSRF_ALLOWLIST` (dev/test only, refused in production), `PROXY_CONNECT_TIMEOUT_MS`, `PROXY_HEADERS_TIMEOUT_MS`, `PROXY_TOTAL_TIMEOUT_MS`, `PROXY_MAX_BODY_BYTES`, `PROXY_MAX_RESPONSE_BYTES`, `LOG_FLUSH_INTERVAL_MS`, `LOG_FLUSH_BATCH_SIZE`, `LOG_BUFFER_MAX`, `LOG_RETENTION_DAYS`. Each is introduced in the guide step that needs it.

## Redis keys

- `project:{slug}`: project id, upstream URL, default limits (5 min TTL; deleted on project update/delete)
- `apikey:{hash}`: key id, project id, own limits, revoked flag, or "not found" (5 min / 30 s; deleted on revoke)
- `rl:{keyId}`: token bucket
- `rl:login:{ip}`: login attempt bucket
- `lastused:{keyId}`: 60 s throttle marker for `last_used_at` writes

## Gateway errors

Every gateway-generated error returns JSON `{ error, message, requestId }` plus header `X-Gateway-Error: true`. Upstream errors pass through unchanged.

| Status | Code | When |
| --- | --- | --- |
| 400 | `validation_error` | bad admin body/params |
| 401 | `unauthorized` | missing/invalid/revoked API key, or no admin session |
| 403 | `upstream_blocked` | SSRF check blocked upstream |
| 403 | `csrf_failed` | bad origin on admin request |
| 404 | `not_found` | unknown slug or admin resource |
| 409 | `conflict` | duplicate slug |
| 413 | `payload_too_large` | request body over limit |
| 429 | `rate_limited` | bucket empty (with `Retry-After`) |
| 502 | `upstream_unreachable` | DNS failure, refused, bad/oversized response |
| 504 | `upstream_timeout` | upstream too slow |
| 503 | `not_ready` | `/readyz` failing or shutting down |

## Hook order on a proxied request

1. Request ID assigned
2. Project lookup by slug (404)
3. API key auth (401)
4. Rate limit (429) + rate-limit headers
5. Body size check (413)
6. SSRF-safe connect inside forwarding (403/502)
7. Forward + stream response (502/504 on failure)
8. On response finished → push log record to buffer

## Testing

- Unit: key hashing, header filtering, IP range checks.
- Integration (real Redis + Postgres via Testcontainers): auth flow, rate limiter under concurrency, revocation, log flush.
- Security: SSRF cases.
- k6 scenarios: baseline (vs direct upstream for overhead), ramp-up, rate-limit stress, slow upstream. Results go in `docs/benchmarks.md` with machine specs, RPS, p50/p95/p99, error rate, bottleneck found.

## Deployment & docs

- Multi-stage Dockerfile, small image, non-root user. Managed Postgres + Redis (Redis must support Lua). Public URL with a demo project.
- CI: lint, typecheck, tests, build, Docker build.
- Docs: README (demo link, quick start, diagram), `docs/architecture.md`, 3–5 ADRs in `docs/adr/` (token bucket, key hashing, fail-open decision, SSRF approach, log buffering), OpenAPI for the admin API, `docs/benchmarks.md`.
