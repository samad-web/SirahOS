# Sirahos — Production Deployment Guide

## Architecture

```
[Vercel]  ──  Frontend (React SPA)
    │
    │  HTTPS requests to VITE_API_BASE_URL
    ▼
[Render]  ──  Backend (Express API)
    │
    │  Prisma ORM
    ▼
[Supabase] ── PostgreSQL Database
```

---

## 1. Pre-deployment Checklist

- [ ] Generate strong JWT secrets (see below)
- [ ] Push code to GitHub (ensure `.env` files are NOT committed)
- [ ] Rotate any secrets that were previously exposed in git history
- [ ] Verify `server/.env.example` and `.env.example` are up to date

### Generate JWT Secrets

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Run this twice — once for `JWT_ACCESS_SECRET`, once for `JWT_REFRESH_SECRET`.

---

## 2. Deploy Backend on Render

### Option A: Blueprint (Recommended)

1. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
2. Connect your GitHub repo
3. Render will auto-detect `render.yaml` and configure the service
4. Set the environment variables marked `sync: false` in the Render dashboard

### Option B: Manual Setup

1. **New** → **Web Service**
2. Connect your GitHub repo
3. Configure:
   - **Root directory**: `server`
   - **Build command**: `npm install && npx prisma generate && npm run build`
   - **Start command**: `npx prisma migrate deploy && npm run start`
   - **Health check path**: `/health`
4. Add all environment variables from `server/.env.example`

### Required Environment Variables (Render)

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `10000` (Render default) |
| `DATABASE_URL` | Your Supabase pooled connection string |
| `DIRECT_URL` | Your Supabase direct connection string |
| `SUPABASE_URL` | `https://your-project.supabase.co` |
| `SUPABASE_ANON_KEY` | Your Supabase anon key |
| `JWT_ACCESS_SECRET` | Generated 64-byte hex string |
| `JWT_REFRESH_SECRET` | Generated 64-byte hex string |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `CORS_ORIGIN` | Your Vercel frontend URL (e.g. `https://sirahos.vercel.app`) |
| `LEADS_SUPABASE_URL` | Leads Supabase URL |
| `LEADS_SUPABASE_KEY` | Leads Supabase service role key |
| `EVOLUTION_API_URL` | Evolution API URL |
| `EVOLUTION_API_KEY` | Evolution API key |
| `EVOLUTION_INSTANCE` | Evolution instance name |

### Verify Backend

```bash
curl https://sirahos-api.onrender.com/health
```

Expected: `{"status":"ok","database":"connected",...}`

---

## 3. Deploy Frontend on Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) → **Add New** → **Project**
2. Import your GitHub repo
3. Vercel auto-detects Vite — `vercel.json` handles SPA routing
4. Add the environment variable:

| Variable | Value |
|----------|-------|
| `VITE_API_BASE_URL` | `https://sirahos-api.onrender.com/api` |

5. Deploy

### Custom Domain (Optional)

1. In Vercel project → **Settings** → **Domains**
2. Add your domain (e.g. `app.sirahos.com`)
3. Update DNS records as Vercel instructs
4. Update `CORS_ORIGIN` on Render to include the custom domain

---

## 4. Post-deployment Verification

1. **Health check**: `curl https://sirahos-api.onrender.com/health`
2. **Frontend loads**: Visit your Vercel URL
3. **Login works**: Test with an existing user account
4. **API connectivity**: Check browser DevTools Network tab for successful API calls
5. **HTTPS**: Both Vercel and Render provide automatic SSL

---

## 5. CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push/PR to `main`:

- **Frontend**: Lint + production build
- **Backend**: Prisma generate + TypeScript compilation

### Auto-deploy

- **Vercel**: Auto-deploys on push to `main` (configured in Vercel dashboard)
- **Render**: Auto-deploys on push to `main` (configured in Render dashboard)

---

## 6. Monitoring & Logging

- **Backend logs**: Render dashboard → Service → Logs
- **Health endpoint**: `GET /health` returns DB status and uptime
- **Error tracking**: Each 500 error includes a unique `errorId` in logs
- **Rate limiting**: 200 req/15min (global), 20 req/15min (auth)

---

## 7. Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS errors | Ensure `CORS_ORIGIN` on Render matches your Vercel URL exactly (no trailing slash) |
| 502 on Render | Check Render logs — likely a missing env var or DB connection issue |
| Login fails | Verify `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are set |
| Blank page on Vercel | Verify `VITE_API_BASE_URL` is set and includes `/api` suffix |
| DB connection timeout | Check `DATABASE_URL` uses the pooled connection (port 6543) |

---

## 8. Security Notes

- All secrets are managed via environment variables — never committed to git
- JWT tokens use cryptographically random 64-byte secrets
- HTTPS is enforced by both Vercel and Render
- Helmet.js sets security headers on the backend
- Rate limiting protects against brute-force attacks
- `trust proxy` is enabled in production for correct IP detection behind load balancers
