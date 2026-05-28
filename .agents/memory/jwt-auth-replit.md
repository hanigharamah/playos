---
name: JWT auth in Replit proxy environment
description: Why session cookies fail in Replit's proxied preview and how JWT in localStorage fixes it
---

Session cookies (even with SameSite=None; Secure) are silently blocked in Replit's proxied preview iframe environment. The session IS saved to PostgreSQL correctly after login, but the browser never sends the cookie back on subsequent API requests — confirmed by seeing the session record in `user_sessions` while `/api/auth/me` still returned 401.

**Fix:** Switch to JWT tokens stored in `localStorage`, sent as `Authorization: Bearer <token>` on every request via `setAuthTokenGetter` from the custom-fetch module.

**Why:** The Replit application router proxies `/api/*` to a separate port (8080). Even though all traffic appears same-origin to the browser, the cookie-setting behavior differs from a true same-origin setup in ways that cause browsers to block the cookie.

**How to apply:**
- Backend: `lib/jwt.ts` signs/verifies tokens; `middleware/auth.ts` exports `getUserId(req)` which checks Bearer header first, then session cookie fallback
- All protected routes use `getUserId(req)` instead of `(req.session as any)?.userId`
- Login/signup routes return `{ token, ...user }` in the response body
- Frontend: `lib/auth.tsx` exports `storeAuthToken(token)` and `initAuthToken()` which call `setAuthTokenGetter`
- Login pages call `storeAuthToken(user.token)` on success
- `AuthProvider` calls `initAuthToken()` on mount to restore token from localStorage
