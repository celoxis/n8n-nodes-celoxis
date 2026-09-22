# n8n-nodes-celoxis

This is an n8n community node. It lets you use [Celoxis](https://www.celoxis.com/) in your n8n workflows.

Celoxis is a project management and PSA platform. With this node you can create, update, find, and delete records, and trigger workflows when records are created or updated.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  
[Compatibility](#compatibility)  
[Usage](#usage)  
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes docs.

**Package name:** `n8n-nodes-celoxis`

1. **Self-hosted n8n** → Settings → Community nodes → Install `n8n-nodes-celoxis`
2. **n8n Cloud** → available after [Creator Portal](https://creators.n8n.io/nodes) verification

## Operations

### Triggers

| Trigger | Description |
|---|---|
| On record created | Fires when a Celoxis record is created |
| On record updated | Fires when a Celoxis record is updated |

### Actions

| Action | Description |
|---|---|
| Create a Celoxis record | Create a new record |
| Update a Celoxis record | Update an existing record |
| Get a Celoxis record | Fetch a record by id |
| Find Celoxis records | Search / filter records |
| Upsert a Celoxis record | Create or update |
| Clone a Celoxis record | Clone an existing record |
| Delete a Celoxis record | Delete a record |
| Move a task | Move a task in Celoxis |

Supported record types depend on your Celoxis instance (for example projects, tasks, and other integration-enabled types).

## Credentials

Add credentials of type **Celoxis API**:

| Field | Description |
|---|---|
| **Access Token** | From Celoxis → your profile → **API** (admin) |
| **Server URL** | Celoxis origin, e.g. `https://app.celoxis.com`, `https://eu.celoxis.com`, or your on-prem URL |

The node calls Celoxis at `/api/integrations/v1` on that server.

## Compatibility

- Requires **Node.js 18+**
- Built for n8n community nodes (`n8n-community-node-package`)
- Works with Celoxis SaaS and on-prem instances that expose the integrations API

## Usage

1. Install the community node (see above).
2. Create **Celoxis API** credentials with your access token and server URL.
3. Add a **Celoxis** node to a workflow.
4. Prefer **Get a Celoxis record** for a first test: pick a type (loaded from Celoxis) and a known record id, then execute.

If the **Type** dropdown is empty, the node loaded but the API call failed — check the token, server URL, and that your Celoxis instance has the integrations API available.

**Triggers** use webhooks. Celoxis must be able to reach your n8n webhook URL (public n8n, tunnel, or n8n Cloud). On a private localhost, test actions first.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Celoxis](https://www.celoxis.com/)
- [Report issues](https://github.com/celoxis/n8n-nodes-celoxis/issues)

## License

[MIT](LICENSE)
