# QA Issue Tracker -- shoptest

Last updated: 2026-05-29 | Total: 245 issues

Legend: OPEN / FIXED / WONTFIX

---

## Summary

- Total issues: 245
- FIXED: 242
- WONTFIX: 1
- OPEN: 2

---

## New Issues Found

### F93: WebSocket URL missing token parameter (test mismatch)

- Area: Frontend / api/index.ts
- Environment: Frontend test (api/index.test.ts)
- Steps: Run `supportWebSocketUrl('token')` and check URL
- Expected: URL contains `?token=token` query parameter
- Actual: URL does not contain token (token moved to subprotocol per B16 fix)
- Evidence: Tests expect old behavior, but code was updated for subprotocol auth
- Status: OPEN
- Resolution: Update tests to match new subprotocol behavior

### F94: Auth storage not cleared on 401 error

- Area: Frontend / api/index.ts
- Environment: Frontend test (api/index.test.ts)
- Steps: Trigger 401 error without refresh token, check localStorage
- Expected: `localStorage.getItem('token')` returns null
- Actual: Returns "7" (storage not cleared)
- Evidence: Auth cleanup logic may not be executing properly
- Status: OPEN
- Resolution: Check auth interceptor and cleanup logic

---

## Recent Regression Log

| Date | Time | Result |
|------|------|--------|
| 2026-05-29 | regression #62 | Backend BUILD SUCCESS. Frontend TS clean. 200/214 tests pass, 14 fail in api/index.test.ts. Found F93 (WebSocket token test mismatch) and F94 (auth storage cleanup failure). 2 OPEN issues. Total: 245 issues, 242 FIXED, 1 WONTFIX, 2 OPEN. |

---

## Notes

- Backend compiles successfully, frontend TypeScript passes
- 14 frontend tests failing in api/index.test.ts
- F93 is a test-code mismatch (token moved to subprotocol per B16)
- F94 is a potential auth cleanup bug
- Continuous regression testing is active with 20-minute intervals
