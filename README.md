# CSV Extractor

AI-native CSV importer with intelligent field mapping. Upload any CSV — comma, semicolon, tab, or pipe delimited — and get automatic CRM field mapping via LLMs (Groq → HuggingFace → OpenAI → offline fallback).

## Architecture

```
┌──────────┐     ┌──────────┐     ┌────────────┐
│  Next.js  │────▶│ Express  │────▶│ PostgreSQL │
│  Frontend │     │  Backend │     │  (Prisma)  │
└──────────┘     ├──────────┤     ├────────────┤
                 │   Redis  │     │   MinIO    │
                 │ (Cache)  │     │   (Files)  │
                 ├──────────┤     └────────────┘
                 │  Groq /  │
                 │   HF /   │
                 │  OpenAI  │
                 └──────────┘
```

- **Frontend**: Next.js 14 with TypeScript, react-dropzone, @tanstack/react-virtual
- **Backend**: Express with Prisma ORM, JWT auth, RBAC
- **AI**: Groq (primary) → HuggingFace (fallback) → OpenAI (last resort) → offline Levenshtein/bigram matching
- **Storage**: MinIO (S3-compatible) for CSV files, PostgreSQL for metadata

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- MinIO (or docker compose)

### Setup

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with your API keys and database URL

# 2. Start infrastructure (Docker)
docker compose up -d postgres redis minio

# 3. Backend
cd backend
npm install
npx prisma migrate deploy
npx prisma db seed    # creates admin@test.com / admin123
npm run dev

# 4. Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:3001 — register or login with seeded credentials.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GROQ_API_KEY` | recommended | — | Primary AI provider |
| `HF_TOKEN` | fallback | — | HuggingFace inference |
| `OPENAI_API_KEY` | last resort | — | OpenAI fallback |
| `DATABASE_URL` | yes | — | PostgreSQL connection |
| `REDIS_URL` | yes | `redis://localhost:6379` | Caching & rate limiting |
| `MINIO_ENDPOINT` | yes | `http://localhost:9000` | File storage |
| `JWT_SECRET` | yes | — | Auth signing key |
| `BATCH_SIZE` | no | 500 | Leads per DB batch |
| `LLM_MODEL` | no | `llama-3.1-8b-instant` | Groq model |

## Deployment

See [checklist.txt](./checklist.txt) for Render (backend) + Vercel (frontend) deployment steps.

```bash
# Docker single-server deployment
cd docker
docker compose build
docker compose up -d
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed
```

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register |
| POST | `/api/auth/login` | — | Login |
| GET | `/api/auth/me` | JWT | Profile |
| POST | `/api/csv/upload` | JWT | Upload CSV |
| POST | `/api/csv/sessions/:id/map` | JWT | AI mapping |
| GET | `/api/csv/sessions/:id/preview` | JWT | Preview data |
| POST | `/api/csv/sessions/:id/import` | JWT | Import leads |
| GET | `/api/csv/sessions/:id/summary` | JWT | Import stats |
| GET | `/api/csv/sessions/:id/leads` | JWT | View leads |

## AI Mapping Pipeline

1. **Groq** (primary) — llama-3.1-8b-instant with few-shot prompt
2. **HuggingFace** (fallback) — free tier, same prompt
3. **OpenAI** (last resort) — gpt-4o-mini
4. **Offline mapper** — Levenshtein + bigram/trigram n-gram scoring + abbreviation detection

Each AI call has automatic retry with exponential backoff (1s, 3s, 5s). Invalid schema fields are rejected with validation.

## Testing

```bash
cd backend
npm test                    # 87+ unit & E2E tests
node tests/edge-cases.js   # 15 edge-case CSV variants
```

## Security

- JWT authentication with bcrypt password hashing
- RBAC permissions (admin, editor, viewer)
- Multer fileFilter restricts to CSV-only uploads
- CORS restricted to frontend origin
- Rate limiting on auth endpoints
- `.env` never committed

## License

MIT
