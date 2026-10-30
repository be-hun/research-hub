# Research Hub

Temple ResearchConnect AI: a research discovery platform for finding projects and cross-college collaborators at Temple University.

## Layout

- `frontend/`: Next.js 14 + Tailwind app. Design tokens come from the Stitch "ResearchConnect AI – Concept v3" project.
- `backend/`: API (not started). Contract in [docs/api.md](docs/api.md).

## Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

Uses mock data until `NEXT_PUBLIC_API_URL` is set (e.g. `http://localhost:8000`).

## MVP scope

Built: Home, Search Results. Placeholder routes: Project Detail, Researcher Profile, Collaborator Matches, Assistant, Pathways, Responsible AI.
Out of scope: CV upload.
