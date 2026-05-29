# Test Issues

This file is used by QA to record issues found during testing.

## Status Log

- 2026-05-29 22:30 UTC: **Regression #62.** Backend BUILD SUCCESS. Frontend TS clean. 200/214 tests pass, 14 fail in api/index.test.ts. Found F93 (WebSocket token test mismatch) and F94 (auth storage cleanup failure). 2 OPEN issues. Total: 245 issues, 242 FIXED, 1 WONTFIX, 2 OPEN.

## Open Issues

### F93: WebSocket URL missing token parameter (test mismatch)

- Area: Frontend / api/index.ts
- Environment: Frontend test (api/index.test.ts)
- Steps: Run `supportWebSocketUrl('token')` and check URL
- Expected: URL contains `?token=token` query parameter
- Actual: URL does not contain token (token moved to subprotocol per B16 fix)
- Status: Open
- Resolution: Update tests to match new subprotocol behavior

### F94: Auth storage not cleared on 401 error

- Area: Frontend / api/index.ts
- Environment: Frontend test (api/index.test.ts)
- Steps: Trigger 401 error without refresh token, check localStorage
- Expected: `localStorage.getItem('token')` returns null
- Actual: Returns "7" (storage not cleared)
- Status: Open
- Resolution: Check auth interceptor and cleanup logic

## Resolved Issues

243 issues resolved. See QA_ISSUES.md for full history.

## Test Coverage

- Backend: 44 services, 34 controllers, 103+ DTOs, 15 mapper XMLs reviewed
- Frontend: 92+ pages, 15+ components, 4 hooks, 43 test files reviewed
- Security: CORS, CSRF, JWT, rate limiting, IP blacklist, SSRF protection verified
- Performance: Database queries, caching, pagination, batch operations reviewed
- i18n: EN/ZH/ES locales complete with 2776 keys each
