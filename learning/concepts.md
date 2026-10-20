# Concepts

Durable understanding worth keeping. Add dated entries.

- **Learner's explanation:** NestJS over Next.js API routes because Next.js can open multiple DB connections.

- **Corrected understanding:** Serverless Next.js can run concurrent requests as separate instances, each opening its own Postgres connection, hitting `max_connections` at scale. NestJS keeps one long-running process with one reused pool.

- **Example:** 2 users hit the dashboard at once → Next.js could open 2 connections; NestJS reuses 1 pool for both.

- **Related concepts:** connection pooling, PgBouncer, Prisma Accelerate, Neon's built-in pooler.

---

