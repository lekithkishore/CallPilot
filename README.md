# CallPilot

CallPilot is a caller-facing guide for cold calls. It guides a caller through eight stages, captures quick outcomes and the prospect's own words, and stores call history in Supabase.

## Stack
- Frontend: React, TypeScript, Vite
- Backend: Node.js, Express, TypeScript
- Database: Supabase (Postgres)
- AI coaching: Gemini via the backend only

## Local setup

### 1. Supabase
Run `backend/sql/schema.sql` in the Supabase SQL Editor. Create a backend `.env` based on `backend/.env.example` and set the Supabase project URL and service-role key. Never expose the service-role key in the frontend or commit `.env` files.

### 2. Backend
```bash
cd backend
npm install
npm run dev
```
The health endpoint is `http://localhost:5000/health`. Set `GEMINI_API_KEY` in the backend environment to enable the AI call coach.

### 3. Frontend
Create `frontend/.env.local` from `frontend/.env.example`, then run:
```bash
cd frontend
npm install
npm run dev
```
Open the Vite URL shown in the terminal (usually `http://localhost:5173`).

## API endpoints
- `GET /health` — backend health check
- `POST /api/calls` — start a call
- `PUT /api/calls/:id/stages/:stageNumber` — save a stage result and prospect words
- `POST /api/calls/:id/close` — close a call and store outcome, next step, and summary
- `GET /api/calls` — list call history
- `GET /api/calls/:id` — retrieve one call and its stage results
- `POST /api/coach` — generate stage-aware coaching with Gemini

## Deployment
- Deploy `backend` as a Render web service. Build command: `npm install && npm run build`; start command: `npm start`. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, and `FRONTEND_URL` in Render environment settings. `FRONTEND_URL` should be the deployed Vercel URL.
- Deploy `frontend` to Vercel with the root directory set to `frontend`. Add `VITE_API_URL` set to the deployed Render base URL (no trailing slash), then redeploy.
- Add the deployed Vercel origin to `FRONTEND_URL` in Render and redeploy the backend.
- Add the final public URLs here before submission:
  - Vercel app: TODO
  - Render health endpoint: TODO
  - GitHub repository: TODO

## LLM purpose
The Gemini-backed coach receives the current stage, its purpose, the caller-selected outcome, and the prospect's captured words. It returns a short acknowledgment, a suggested response, and a follow-up question. The Gemini API key stays on the backend.

## Transcript handling
The stage response examples are distilled from the supplied fictionalized transcript dataset. The raw transcript archive is for analysis/testing and must not be published in this repository.
