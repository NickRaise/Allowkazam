# Allowkazam

A developer API gateway: a proxy that sits in front of an existing API and manages access, rate limiting and request logging. Work in progress, built step by step.

## Current status

Built so far:

- Turborepo + pnpm monorepo.
- `apps/gateway`: minimal Fastify server (hello-world route only).
- ESLint in `@gw/gateway` and `@gw/shared`, using the shared `@repo/eslint-config/base` (lints `.js` and `.ts`).
- `packages/shared` (`@gw/shared`): shared package, compiled with `tsc` to `dist/` and linked into the gateway as a `workspace:*` dependency. Currently exports only a placeholder constant; `zod` is installed for future schemas.

## Repo layout

| Path | Package | Purpose |
| --- | --- | --- |
| `apps/gateway` | `@gw/gateway` | Fastify server (proxy + admin routes) |
| `apps/web` | `web` | Next.js starter app from the template |
| `packages/shared` | `@gw/shared` | Shared code; consumed from its built `dist/` |
| `packages/eslint-config` | `@repo/eslint-config` | ESLint configs |
| `packages/typescript-config` | `@repo/typescript-config` | Base tsconfigs |

## Getting started

Requires Node 22+ and pnpm.

```sh
pnpm install
pnpm turbo run build                  # builds @gw/shared first, then the gateway
pnpm turbo run build --filter=@gw/gateway # one app (its dependencies build first)
pnpm --filter @gw/gateway dev             # run the gateway with tsx watch
pnpm lint                             # lint all packages (problems show as warnings)
```

`@gw/shared` must be built (`dist/` present) before the gateway or Next.js can import it; `turbo run build` handles the order. While editing shared code, run `pnpm --filter @gw/shared dev` to rebuild on change.
