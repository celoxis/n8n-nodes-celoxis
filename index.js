/**
 * Thin n8n wrapper around the common Celoxis adapter.
 * Maps n8n credentials / node params ↔ common adapter only.
 *
 * n8n loads credentials/ + nodes/Celoxis/ via package.json "n8n".
 * This file is the runtime helper those node classes require.
 * No Celoxis entity/schema/business logic here.
 */

'use strict';

const { createCeloxisAdapter } = require('./lib/celoxisAdapter');
const mapping = require('./mapping');

/**
 * @param {{ serverUrl: string, accessToken: string, httpRequest: Function }} ctx
 *   httpRequest: async ({ url, method, headers, body }) => parsedJson
 */
function adapterFromN8n(ctx) {
  return createCeloxisAdapter({
    serverUrl: ctx.serverUrl,
    accessToken: ctx.accessToken,
    extraHeaders: { 'X-N8N': true },
    request: ctx.httpRequest,
  });
}

function credentialsFromN8n(credentials) {
  return {
    serverUrl: credentials.serverUrl || credentials.server_url,
    accessToken: credentials.accessToken || credentials.access_token,
  };
}

async function adapterFromN8nThis(n8nThis, credentialName) {
  const credentials = await n8nThis.getCredentials(credentialName || 'celoxisApi');
  const auth = credentialsFromN8n(credentials);
  return adapterFromN8n({
    serverUrl: auth.serverUrl,
    accessToken: auth.accessToken,
    httpRequest: async (opts) => {
      return n8nThis.helpers.httpRequest({
        url: opts.url,
        method: opts.method,
        headers: opts.headers,
        body: opts.body,
        json: true,
      });
    },
  });
}

const credentials = {
  name: 'celoxisApi',
  displayName: 'Celoxis API',
  documentationUrl: 'https://www.celoxis.com/',
  icon: 'file:../nodes/Celoxis/celoxis.svg',
  properties: [
    {
      displayName: 'Access Token',
      name: 'accessToken',
      type: 'string',
      typeOptions: { password: true },
      required: true,
      description:
        'Paste your API access token from your profile (API). Administrator privileges are required.',
    },
    {
      displayName: 'Server URL',
      name: 'serverUrl',
      type: 'string',
      required: true,
      default: 'https://app.celoxis.com',
      description:
        'US SaaS: https://app.celoxis.com. EU SaaS: https://eu.celoxis.com. On-premise: use the host from Administration > Site Settings.',
    },
  ],
  authenticate: {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '=Bearer {{$credentials.accessToken}}',
        'X-N8N': true,
      },
    },
  },
  test: {
    request: {
      baseURL: '={{$credentials.serverUrl}}',
      url: '/psa/api/v2/me',
      headers: {
        'X-N8N': true,
      },
    },
    rules: [
      {
        type: 'responseCode',
        properties: {
          value: 500,
          message:
            'Connection rejected. Check access token, Server URL, and that your plan includes the integration.',
        },
      },
    ],
  },
};

function bindMethods(getAdapter) {
  const resolve = getAdapter || adapterFromN8nThis;
  return {
    loadOptions: {
      async getEntityKeys() {
        const adapter = await resolve(this);
        const operation = this.getCurrentNodeParameter('operation');
        return mapping.getEntityOptions(adapter, { operation: operation });
      },
      async getTriggerEntityKeys() {
        const adapter = await resolve(this);
        const event = this.getCurrentNodeParameter('event');
        return mapping.getEntityOptions(adapter, { event: event });
      },
      async getTriggerTransitions() {
        const adapter = await resolve(this);
        const entityKey = this.getCurrentNodeParameter('entityKey');
        return mapping.getTriggerTransitionOptions(adapter, entityKey);
      },
      async getTransitionOptions() {
        const adapter = await resolve(this);
        const entityKey = this.getCurrentNodeParameter('entityKey');
        let recordId = '';
        try {
          recordId = this.getCurrentNodeParameter('recordId');
        } catch (e) {
          recordId = '';
        }
        return mapping.getTransitionOptions(adapter, entityKey, recordId);
      },
      async getSearchFilterFields() {
        const adapter = await resolve(this);
        const entityKey = this.getCurrentNodeParameter('entityKey');
        return mapping.getSearchFilterFields(adapter, entityKey);
      },
      async getSearchFilterOperators() {
        const adapter = await resolve(this);
        const entityKey = this.getCurrentNodeParameter('entityKey');
        let fieldKey = '';
        try {
          // Sibling Field on the same condition row (n8n fixedCollection).
          fieldKey = this.getCurrentNodeParameter('searchFilters.conditions.field') || '';
        } catch (e) {
          fieldKey = '';
        }
        if (!fieldKey) {
          try {
            const filters = this.getCurrentNodeParameter('searchFilters');
            const rows =
              filters && Array.isArray(filters.conditions) ? filters.conditions : [];
            const last = rows.length ? rows[rows.length - 1] : null;
            fieldKey = (last && last.field) || '';
          } catch (e) {
            fieldKey = '';
          }
        }
        return mapping.getSearchFilterOperators(adapter, entityKey, fieldKey);
      },
    },
    resourceMapping: {
      async getMappingColumns() {
        const adapter = await resolve(this);
        const operation = this.getCurrentNodeParameter('operation');
        const entityKey =
          operation === 'move'
            ? 'tasks'
            : this.getCurrentNodeParameter('entityKey');
        const values = this.getCurrentNodeParameters
          ? this.getCurrentNodeParameters()
          : {};
        return mapping.getMappingColumns(adapter, entityKey, operation, values);
      },
    },
  };
}

function webhookMethods(getAdapter) {
  const resolve = getAdapter || adapterFromN8nThis;
  return {
    default: {
      async checkExists() {
        const data = this.getWorkflowStaticData('node');
        return !!(data && data.subscriptionId);
      },
      async create() {
        const adapter = await resolve(this);
        const entityKey = this.getNodeParameter('entityKey');
        const event = this.getNodeParameter('event');
        let transitionId = '';
        try {
          transitionId = this.getNodeParameter('transitionId');
        } catch (e) {
          transitionId = '';
        }
        const targetUrl = this.getNodeWebhookUrl('default');
        const res = await mapping.subscribe(adapter, entityKey, event, targetUrl, undefined, transitionId);
        const data = this.getWorkflowStaticData('node');
        data.subscriptionId = res && (res.id || (res.data && res.data.id));
        return true;
      },
      async delete() {
        const data = this.getWorkflowStaticData('node');
        const id = data && data.subscriptionId;
        if (!id) {
          return true;
        }
        const adapter = await resolve(this);
        await mapping.unsubscribe(adapter, id);
        delete data.subscriptionId;
        return true;
      },
    },
  };
}

async function execute(n8nThis, getAdapter) {
  const resolve = getAdapter || adapterFromN8nThis;
  const adapter = await resolve(n8nThis);
  const items = n8nThis.getInputData();
  const returnData = [];
  for (let i = 0; i < items.length; i++) {
    const operation = n8nThis.getNodeParameter('operation', i);
    const entityKey =
      operation === 'move' ? 'tasks' : n8nThis.getNodeParameter('entityKey', i);
    const params = {
      entityKey: entityKey,
      id: needsIdParam(operation) ? n8nThis.getNodeParameter('id', i) : undefined,
      fields: SCHEMA_OPS.has(operation)
        ? n8nThis.getNodeParameter('fields', i, {})
        : undefined,
    };
    if (operation === 'transition') {
      params.recordId = n8nThis.getNodeParameter('recordId', i);
      params.transitionId = n8nThis.getNodeParameter('transitionId', i);
    }
    if (operation === 'search') {
      try {
        params.searchFilters = n8nThis.getNodeParameter('searchFilters', i, {});
      } catch (e) {
        params.searchFilters = {};
      }
      try {
        params.page = n8nThis.getNodeParameter('page', i, 1);
      } catch (e) {
        params.page = undefined;
      }
      try {
        const limit = n8nThis.getNodeParameter('limit', i, 0);
        params.limit = limit > 0 ? limit : undefined;
      } catch (e) {
        params.limit = undefined;
      }
      try {
        params.sort = n8nThis.getNodeParameter('sort', i, '');
      } catch (e) {
        params.sort = undefined;
      }
    }
    const result = await mapping.executeItem(adapter, operation, params);
    mapping.toN8nItems(result, i).forEach((item) => returnData.push(item));
  }
  return [returnData];
}

function needsIdParam(operation) {
  return mapping.needsId(operation);
}

const SCHEMA_OPS = new Set(mapping.SCHEMA_OPS);

async function webhook(n8nThis) {
  const body = n8nThis.getBodyData ? n8nThis.getBodyData() : n8nThis.getRequestObject().body;
  const rows = mapping.parseWebhookBody(body);
  return {
    workflowData: [mapping.toN8nItems(rows)],
  };
}

module.exports = {
  credentials,
  bindMethods,
  webhookMethods,
  execute,
  webhook,
  mapping,
};
