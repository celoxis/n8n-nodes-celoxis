# n8n-nodes-celoxis

Official Celoxis community node for n8n. Install it in your n8n instance, connect with a Celoxis API token, and automate projects, tasks, and other records.

```
n8n-nodes-celoxis/
  credentials/CeloxisApi.credentials.ts
  nodes/Celoxis/
    Celoxis.node.ts
    CeloxisTrigger.node.ts
    GenericFunctions.ts
    operations.js
    helpers/                   API transport + shared mapping helpers
    celoxis.svg
  dist/                        build output (published)
  package.json
```

---

## Install (customers)

### Self-hosted n8n

1. Settings → Community nodes → Install
2. Package name: `n8n-nodes-celoxis`

### n8n Cloud

Search for **Celoxis** in the nodes panel after verification on the [Creator Portal](https://creators.n8n.io/nodes).

### Credentials

| Field | Description |
|---|---|
| Access Token | Celoxis profile → API (admin) |
| Server URL | `https://app.celoxis.com`, `https://eu.celoxis.com`, or your on-prem origin |

---

## Operations

| Triggers | Actions |
|---|---|
| On record created | Create a Celoxis record |
| On record updated | Update / Get / Find / Upsert / Clone / Delete record, Move a task |

---

## 1. Test locally (developers)

You need a running n8n instance (default `http://localhost:5678`). Celoxis appears only after this package is linked and n8n is restarted.

### Install n8n CLI if needed

```bash
npm install -g n8n
```

### Link this package into n8n (recommended)

```bash
# from the root of this repository (n8n-nodes-celoxis):
cd /path/to/n8n-nodes-celoxis
npm link

mkdir -p ~/.n8n/custom
cd ~/.n8n/custom
npm init -y
npm link n8n-nodes-celoxis
```

Stop any n8n process on port 5678, then:

```bash
n8n start
```

Open `http://localhost:5678` → **Add first step** → search **Celoxis**.

If Celoxis does not appear: n8n was not restarted, or a different n8n is still running (Docker, desktop app, another Node process). Quit that one and start `n8n start` from a terminal after the `npm link` steps.

### Alternative: env var (no npm link)

```bash
# set to the absolute path of your local n8n-nodes-celoxis clone:
export N8N_CUSTOM_EXTENSIONS="/path/to/n8n-nodes-celoxis"
n8n start
```

### Exercise a real call

1. Celoxis must be reachable at `/api/integrations/v1` (SaaS or on-prem).
2. In n8n: Credentials → **Celoxis API** — Access Token + Server URL.
3. Add **Celoxis** → action **Get a Celoxis record** (safest first test).
4. **Type** should fill from Celoxis (projects, tasks, …). If empty, the node loaded but the API call failed — check token, URL, and that the integration API is available.
5. Enter a known record id → Execute step.

Triggers need a reachable webhook URL. On localhost use n8n’s webhook test URL only if Celoxis can POST to it (tunnel / n8n cloud), or test actions first.

### Package regression tests (no live Celoxis)

```bash
npm test
```

---

## 2. Publish (npm + GitHub Actions)

Package name: `n8n-nodes-celoxis`. Keep the keyword `n8n-community-node-package`.

Do **not** use laptop `npm publish` for verification. Publish via tag → GitHub Actions (`.github/workflows/publish.yml`) with npm provenance.

```bash
# from this package root:
npm version 1.0.0   # or patch / minor / major
git push origin main --follow-tags
```

One-time on npm: Trusted Publisher → GitHub Actions → owner `celoxis`, repo `n8n-nodes-celoxis`, workflow `publish.yml`.
