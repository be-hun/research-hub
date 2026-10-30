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

Pages: Home, Search Results, Project Detail, Researcher Profile, Collaborator Matches, Assistant, Student Pathways,
Opportunities (board + post form), Responsible AI.

Sources: Stitch "ResearchConnect AI – Concept v3" (core flow) plus "Post a Student Opportunity" from Concept v2.
Out of scope: CV upload.

Mock data lives in `frontend/src/lib/mock.ts`. Pathways uses sample student data inline in its page.
Not pulled from v2 yet: Faculty Profile Editor, Student Dashboard, Opportunities Board layout.
