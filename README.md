# n8n-nodes-celoxis

This is an n8n community node. It lets you use [Celoxis](https://www.celoxis.com/) in your n8n workflows.

[Celoxis](https://www.celoxis.com/) is a project management and work management platform. With this node you can create, update, find, delete, and trigger on Celoxis records (projects, tasks, time entries, custom apps, and more).

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  
[Compatibility](#compatibility)  
[Usage](#usage)  
[Resources](#resources)  

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

### Community Nodes (recommended)

1. In your n8n instance, go to **Settings → Community Nodes**
2. Select **Install**
3. Enter `n8n-nodes-celoxis`
4. Agree to the risks and select **Install**

After installation, search for **Celoxis** or **Celoxis Trigger** when adding a node.

### Manual installation (self-hosted)

```bash
npm install n8n-nodes-celoxis
```

Restart n8n after installing.

## Operations

### Celoxis (actions)

| Operation | Description |
|---|---|
| **Create Record** | Create a record. Choose **Type**, then complete the fields for that type. |
| **Update Record** | Update a record. Choose **Type** and **ID**, then set the fields to change. |
| **Get Record** | Get one record by **Type** using exactly one identifier: ID, Project Code, External Key, or GUID (when supported). |
| **Find Records** | Find records matching filters (all conditions must match), with optional page, limit, and sort. |
| **Upsert Record** | Create or update a record. Only types that support upsert appear under **Type**. |
| **Clone Record** | Clone an existing record. |
| **Delete Record** | Delete a record. Choose **Type** and **ID**. Only deletable types appear under **Type**. |
| **Move Task** | Move a task to another project, optionally under a parent task. |
| **Do State Transition** | Run a workflow transition on a custom app record. |

### Celoxis Trigger

| Event | Description |
|---|---|
| **Record Created** | Starts the workflow when a record is created. Choose **Type** first. |
| **Record Updated** | Starts the workflow when a record is updated. Choose **Type** first. |

Supported record types are loaded dynamically from your Celoxis account (for example projects, tasks, time entries, and custom apps available to your token).

## Credentials

This node uses **Celoxis API** credentials.

### Prerequisites

- A Celoxis account (US SaaS, EU SaaS, or on-premise)
- An API access token from a user with administrator privileges

### How to get your access token

1. Sign in to Celoxis
2. Open your **profile**
3. Go to **API**
4. Copy the access token

### Credential fields

| Field | Required | Description |
|---|---|---|
| **Access Token** | Yes | Paste the API access token from your Celoxis profile. |
| **Server URL** | Yes | Base URL of your Celoxis site. |

Examples for **Server URL**:

| Environment | Server URL |
|---|---|
| US SaaS | `https://app.celoxis.com` |
| EU SaaS | `https://eu.celoxis.com` |
| On-premise | Your Celoxis origin (from **Administration → Site Settings**) |

The credential test calls `/psa/api/v2/me` on the Server URL to verify the token.

## Compatibility

- Requires n8n with community nodes support
- Requires Node.js 18 or newer on self-hosted n8n
- Tested against current n8n releases used with community node packages
- Works with Celoxis US SaaS, EU SaaS, and on-premise installations that expose the Celoxis integration API

## Usage

### 1. Add credentials

1. In n8n, open **Credentials**
2. Create **Celoxis API**
3. Paste your **Access Token**
4. Set **Server URL** (for example `https://app.celoxis.com`)
5. Save and test the credential

### 2. Run an action (example: Get a record)

1. Add a **Celoxis** node to your workflow
2. Select operation **Get Record**
3. Choose **Type** (for example Project or Task)
4. Enter exactly one identifier (ID, Project Code, External Key, or GUID, depending on the type)
5. Execute the step

**Type** and field lists are loaded from Celoxis. If **Type** is empty, check the credential token, Server URL, and that your Celoxis site is reachable.

### 3. Create or update a record

1. Add a **Celoxis** node
2. Choose **Create Record** or **Update Record**
3. Select **Type**
4. Fill the dynamic fields shown for that type
5. For update, also provide the record **ID**

### 4. Find records

1. Choose **Find Records**
2. Select **Type**
3. Add filter conditions (all conditions must match)
4. Optionally set page, limit, and sort
5. Execute the step

### 5. Use triggers

1. Add a **Celoxis Trigger** node
2. Choose **Record Created** or **Record Updated**
3. Select **Type**
4. Activate the workflow so n8n can register the webhook with Celoxis

Triggers need a URL that Celoxis can reach. On local n8n, use a tunnel or n8n Cloud; otherwise test actions first.

### Tips

- Start with **Get Record** to confirm credentials and connectivity
- Field labels and required fields follow your Celoxis configuration for that type
- For custom apps, use **Do State Transition** to run workflow transitions
- Use expressions (for example `{{ $json.id }}`) to pass IDs between nodes

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
* [Install community nodes](https://docs.n8n.io/integrations/community-nodes/installation/)
* [Celoxis](https://www.celoxis.com/)
* [Celoxis help / API](https://www.celoxis.com/help)
* [GitHub repository](https://github.com/celoxis/n8n-nodes-celoxis)
* [npm package](https://www.npmjs.com/package/n8n-nodes-celoxis)
