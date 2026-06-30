# Test Environment (2026-06-05)

## Host

- User: `guhao` (uid 1000)
- Working dir: `/home/guhao/shoptest`
- Project: ShopMX pet store — Spring Boot + React, port 8080
- Domain: `pet.686888666.xyz`

## Tooling

- JDK 21
- Maven (via `./mvnw`)
- Node 22, npm 10
- Jest 30 (run with `npm test -- --runInBand`)

## Permissions Gotchas

- `target/` is **root-owned** (set 2026-06-05 06:48 by an earlier elevated run). Maven `process-classes` fails on `target/classes/application.yml` because `guhao` cannot overwrite a root-owned file. Fix: `sudo chown -R guhao:guhao target/` outside the session.
- `~/.claude` is the canonical memory dir — write there, not into the project.

## Services

- MySQL: Docker, port 3306
- Redis: Docker, port 6379

## Scheduled Work

- Cron job `be02f0c4` — regression test every 20 min, session-only.
