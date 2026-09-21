# n8n-nodes-celoxis

Celoxis for n8n — same idea as the Zapier app: customers run **their** n8n, install this node, connect with a Celoxis token.

```
n8n-wrapper/                          npm name: n8n-nodes-celoxis
  credentials/CeloxisApi.credentials.js
  nodes/Celoxis/
    Celoxis.node.js                   actions
    CeloxisTrigger.node.js            created / updated
  lib/                                vendored from integrations/common
    celoxisAdapter.js
    mappingCore.js
  mapping.js
  index.js
  package.json
```

---

## 1. Test locally (do this first)

You already have n8n at `http://localhost:5678`. It will **not** show Celoxis until this package is linked and n8n is restarted.

### Install n8n CLI if needed

```bash
npm install -g n8n
```

### Link this package into n8n (recommended)

```bash
cd /Users/akhlesh/working_projects/v15.1.0/psa/base/src/integrations/n8n-wrapper
npm link

mkdir -p ~/.n8n/custom
cd ~/.n8n/custom
npm init -y
npm link n8n-nodes-celoxis
```

Stop the n8n process that is bound to port 5678, then:

```bash
n8n start
```

Open `http://localhost:5678` → **Add first step** → search **Celoxis**.

You should see:

| Triggers | Actions |
|---|---|
| On record created | Create a Celoxis record |
| On record updated | Update / Get / Find / Upsert / Clone / Delete record, Move a task |

If Celoxis does not appear: n8n was not restarted, or a **different** n8n is still running (Docker, desktop app, another Node process). Quit that one and start `n8n start` from a terminal after the `npm link` steps.

### Alternative: env var (no npm link)

```bash
export N8N_CUSTOM_EXTENSIONS="/Users/akhlesh/working_projects/v15.1.0/psa/base/src/integrations/n8n-wrapper"
n8n start
```

### Exercise a real call

1. Celoxis must be running with `/api/integrations/v1` (local app or SaaS).
2. In n8n: Credentials → **Celoxis API**
   - Access Token: Celoxis profile → API (admin)
   - Server URL: `https://app.celoxis.com` / `https://eu.celoxis.com` / your on-prem origin
3. Add **Celoxis** → action **Get a Celoxis record** (safest first test).
4. **Type** should fill from Celoxis (projects, tasks, …). If it is empty, the node loaded but the API call failed — check token, URL, and that the integration API is deployed.
5. Enter a known record id → Execute step.

Triggers need a reachable webhook URL. On localhost use n8n’s webhook test URL only if Celoxis can POST to it (tunnel / n8n cloud), or test actions first.

---

## 2. Publish (npm + GitHub Actions)

Package name: `n8n-nodes-celoxis`. Keep the keyword `n8n-community-node-package`.

Do **not** use laptop `npm publish` for verification. Publish via tag → GitHub Actions (`.github/workflows/publish.yml`) with npm provenance.

```bash
# after changing integrations/common, re-vendor:
cp ../common/celoxisAdapter.js ../common/mappingCore.js lib/

# from this package (or the public clone of celoxis/n8n-nodes-celoxis):
npm version 1.0.0   # or patch / minor / major
git push origin main --follow-tags
```

One-time on npm: Trusted Publisher → GitHub Actions → owner `celoxis`, repo `n8n-nodes-celoxis`, workflow `publish.yml`.

Customers:

1. Self-hosted → Settings → Community nodes → Install `n8n-nodes-celoxis`
2. n8n Cloud search → after [Creator Portal](https://creators.n8n.io/nodes) verification

Credentials: Access Token + Server URL.
