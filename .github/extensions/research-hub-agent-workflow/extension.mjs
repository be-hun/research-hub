import { createServer } from "node:http";
import { createCanvas, CanvasError, joinSession } from "@github/copilot-sdk/extension";

const canvasId = "research-hub-agent-workflow";
const instances = new Map();

const workflow = [
  {
    title: "Plan",
    owner: "Shared",
    steps: [
      "Check AGENTS.md and open PRs",
      "Agree on the API contract and file ownership",
      "Branch from origin/backend-foundation",
    ],
  },
  {
    title: "Build",
    owner: "Parallel agents",
    steps: [
      "Claude: frontend screens and UX",
      "Copilot: backend, ingestion, API and tests",
      "Use separate worktrees to avoid overwrites",
    ],
  },
  {
    title: "Handoff",
    owner: "Shared repository",
    steps: [
      "Open a PR into backend-foundation",
      "Document consumed or enabled endpoints",
      "Keep models, TypeScript types and API docs aligned",
    ],
  },
  {
    title: "Integrate",
    owner: "Copilot",
    steps: [
      "Review and merge the feature PRs",
      "Run backend tests and frontend lint/build",
      "Validate the merged integration branch",
    ],
  },
  {
    title: "Deploy",
    owner: "MVP server",
    steps: [
      "Back up the SQLite database",
      "Pull only the merged backend-foundation commit",
      "Restart services and smoke-test health, web and demo profile",
    ],
  },
];

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderWorkflow = () =>
  workflow
    .map(
      (stage, index) => `
        <article class="stage">
          <div class="stage-number">${index + 1}</div>
          <div class="stage-content">
            <p class="owner">${escapeHtml(stage.owner)}</p>
            <h2>${escapeHtml(stage.title)}</h2>
            <ul>${stage.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ul>
          </div>
        </article>
        ${index < workflow.length - 1 ? '<div class="connector" aria-hidden="true">↓</div>' : ""}
      `,
    )
    .join("");

const renderPage = () => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ResearchConnect agent workflow</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #172033;
      background: #f5f7fb;
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; }
    main { max-width: 960px; margin: 0 auto; padding: 36px 24px 48px; }
    header { margin-bottom: 28px; }
    .eyebrow { margin: 0 0 8px; color: #3568c8; font-size: 13px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(28px, 5vw, 44px); letter-spacing: -.03em; }
    .intro { max-width: 700px; margin: 12px 0 0; color: #59677d; font-size: 17px; line-height: 1.55; }
    .workflow { display: grid; justify-items: center; }
    .stage { display: grid; grid-template-columns: 48px 1fr; width: min(100%, 720px); gap: 18px; padding: 22px; border: 1px solid #d8e0ee; border-radius: 18px; background: #fff; box-shadow: 0 8px 24px rgba(37, 58, 93, .08); }
    .stage-number { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; background: #3568c8; color: #fff; font-size: 18px; font-weight: 800; }
    .owner { margin: 0 0 4px; color: #708099; font-size: 12px; font-weight: 750; letter-spacing: .07em; text-transform: uppercase; }
    h2 { margin: 0 0 10px; font-size: 22px; }
    ul { margin: 0; padding-left: 20px; color: #48566c; line-height: 1.65; }
    .connector { height: 38px; color: #3568c8; font-size: 30px; font-weight: 700; line-height: 38px; }
    .truth { width: min(100%, 720px); margin-top: 28px; padding: 18px 20px; border-left: 4px solid #f29b38; border-radius: 10px; background: #fff8ed; color: #684715; line-height: 1.55; }
    .truth strong { color: #4b2d0b; }
    @media (max-width: 560px) {
      main { padding: 26px 16px 36px; }
      .stage { grid-template-columns: 38px 1fr; gap: 12px; padding: 18px; }
      .stage-number { width: 36px; height: 36px; font-size: 16px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="eyebrow">Temple ResearchConnect</p>
      <h1>Claude + Copilot delivery workflow</h1>
      <p class="intro">Frontend and backend work move in parallel, meet through the shared GitHub repository, and reach the MVP server only after the integrated branch passes validation.</p>
    </header>
    <section class="workflow" aria-label="Agent delivery workflow">
      ${renderWorkflow()}
      <aside class="truth"><strong>Source of truth:</strong> <code>be-hun/research-hub</code>, specifically the merged <code>backend-foundation</code> commit; the droplet is a deployed representation, not a separate codebase.</aside>
    </section>
  </main>
</body>
</html>`;

const open = async ({ instanceId }) => {
  if (!instanceId) {
    throw new CanvasError("invalid_input", "A canvas instance ID is required.");
  }

  const existing = instances.get(instanceId);
  if (existing) {
    return existing.url;
  }

  const server = createServer((request, response) => {
    const path = new URL(request.url, "http://127.0.0.1").pathname;
    if (request.method !== "GET" || path !== "/") {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderPage());
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new CanvasError("server_error", "Unable to determine the canvas server address.");
  }

  const url = `http://127.0.0.1:${address.port}/`;
  instances.set(instanceId, { server, url });
  return url;
};

const onClose = async ({ instanceId }) => {
  const instance = instances.get(instanceId);
  if (!instance) return;
  await new Promise((resolve, reject) => instance.server.close((error) => (error ? reject(error) : resolve())));
  instances.delete(instanceId);
};

const canvas = createCanvas({
  id: canvasId,
  displayName: "ResearchConnect agent workflow",
  description: "Visualize how Claude and Copilot coordinate frontend and backend work through the ResearchConnect repository and MVP deployment.",
  actions: [],
  open,
  onClose,
});

await joinSession({ canvases: [canvas] });
