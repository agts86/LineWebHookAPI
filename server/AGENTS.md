# Repository Guidelines

## Project Structure & Module Organization

This repository is a TypeScript / NestJS API organized as a pnpm workspace. Packages are declared in `pnpm-workspace.yaml` as `src/*` and `src/features/*`.

- `src/host`: application entry point and composition root (`src/main.ts`, `src/app.ts`).
- `src/features/auth`, `src/features/webhook`, `src/features/managed`: feature modules with routes, DTOs, services, repositories, and tests.
- `src/shared`: reusable utilities such as JWT, cookies, hashing, datetime, and auth guard helpers.
- `src/infrastructure`: concrete adapters and repository implementations.
- `src/tables`: Prisma schema and generated database access package.

Keep source in each package’s `src/` directory and tests in its `test/` directory. Do not edit generated `dist/`, `coverage/`, `node_modules/`, or `*.tsbuildinfo` files.

## Build, Test, and Development Commands

Use pnpm 10.26.0 with Node.js 24.11.1, as defined in `package.json`.

- `pnpm dev`: runs the host package locally with `node --watch` + `@swc-node/register` (SWC emits the decorator metadata NestJS DI needs) and `src/host/.env`.
- `pnpm build`: builds all workspace packages; `src/tables` also runs `prisma generate`.
- `pnpm test`: runs Vitest across all packages.
- `pnpm lint`: runs ESLint across workspace packages.
- `pnpm --filter @api/host test`: run a command for one package; replace the filter as needed.

## Coding Style & Naming Conventions

Use TypeScript ES modules. Follow the existing file naming pattern: `*.routes.ts`, `*.service.ts`, `*.repository.ts`, `*.dto.ts`, and `*.test.ts`. ESLint requires explicit function return types, `import type` for type-only imports, no `any`, no unused imports, and handled promises. Keep functions small; complexity over 10 is an error and functions over 50 lines warn.

Respect package boundaries: feature modules may depend on their own feature, `src/shared`, and `src/tables`; infrastructure provides concrete implementations; host wires dependencies together.

## Testing Guidelines

Tests use Vitest. Place tests under each package’s `test/` directory and name them `*.test.ts`. Prefer in-memory fakes under `test/support/` when testing services. Use `pnpm test` before submitting changes; use package filters for targeted checks during development. Coverage commands are available as `test:coverage` in individual packages.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commits, for example `feat: ...`, `fix: ...`, and `docs: ...`. Keep commits scoped and descriptive. Pull requests should include a short summary, linked issue when applicable, verification commands run, and any environment or migration notes. Include screenshots only for user-visible behavior.

## Security & Configuration Tips

Keep secrets in local `.env` files and commit only `.env.example`. Document required environment variables when adding configuration. Avoid logging tokens, LINE signatures, cookies, or other credentials.
