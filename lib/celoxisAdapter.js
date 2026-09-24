/**
 * Common Celoxis Integration Adapter
 *
 * Platform-neutral client over /api/integrations/v1.
 * Zapier and n8n wrappers call this; they must not reimplement Celoxis entity/schema/ops/trigger logic.
 *
 * No Zapier SDK or n8n SDK dependencies here.
 */

'use strict';

const DEFAULT_BASE = '/api/integrations/v1';

/**
 * @typedef {object} AdapterConfig
 * @property {string} serverUrl  e.g. https://app.example.com or https://app.example.com/psa
 * @property {string} accessToken  Bearer token
 * @property {Record<string, string|boolean>} [extraHeaders]  e.g. { 'X-N8N': true } / { 'X-Zapier': true }
 * @property {(opts: {url:string, method:string, headers?:object, body?:any}) => Promise<any>} request
 */

/**
 * @param {AdapterConfig} config
 */
function createCeloxisAdapter(config) {
  if (!config || !config.request) {
    throw new Error('createCeloxisAdapter requires config.request');
  }
  const serverUrl = (config.serverUrl || '').replace(/\/$/, '');
  const token = config.accessToken || '';
  const extraHeaders = config.extraHeaders || {};
  const base = DEFAULT_BASE;

  function resolveUrl(path) {
    if (path.startsWith('http')) {
      return path;
    }
    const p = path.startsWith('/') ? path : '/' + path;
    if (serverUrl.endsWith('/psa')) {
      return serverUrl + p;
    }
    return serverUrl + '/psa' + p;
  }

  async function api(method, path, body) {
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
    const opts = { url: resolveUrl(path), method, headers };
    if (body !== undefined && body !== null && method !== 'GET' && method !== 'DELETE') {
      opts.body = body;
    }
    return config.request(opts);
  }

  function entityPath(key) {
    return `${base}/entities/${encodeURIComponent(key)}`;
  }

  return {
    listEntities(query) {
      const q = new URLSearchParams();
      if (query && query.operation) q.set('operation', query.operation);
      if (query && query.event) q.set('event', query.event);
      const qs = q.toString();
      return api('GET', `${base}/entities${qs ? '?' + qs : ''}`);
    },

    schema(entityKey, body) {
      return api('POST', `${entityPath(entityKey)}/schema`, body || { operation: 'create' });
    },

    options(entityKey, fieldKey, body) {
      return api(
        'POST',
        `${entityPath(entityKey)}/fields/${encodeURIComponent(fieldKey)}/options`,
        body || {}
      );
    },

    create(entityKey, payload) {
      return api('POST', entityPath(entityKey), payload);
    },

    /**
     * Get one record. Pass a numeric id (legacy GET) or a lookup object
     * `{ id } | { code } | { externalKey } | { guid }` (POST .../get — exactly one key).
     * `code` is projects only.
     */
    get(entityKey, idOrLookup) {
      if (idOrLookup != null && typeof idOrLookup === 'object') {
        return api('POST', `${entityPath(entityKey)}/get`, idOrLookup);
      }
      return api('GET', `${entityPath(entityKey)}/${idOrLookup}`);
    },

    update(entityKey, id, payload) {
      return api('PATCH', `${entityPath(entityKey)}/${id}`, payload);
    },

    delete(entityKey, id) {
      return api('DELETE', `${entityPath(entityKey)}/${id}`);
    },

    search(entityKey, payload, query) {
      const q = new URLSearchParams();
      if (query && query.sort) q.set('sort', query.sort);
      if (query && query.limit != null) q.set('limit', String(query.limit));
      if (query && query.page != null) q.set('page', String(query.page));
      const qs = q.toString();
      return api('POST', `${entityPath(entityKey)}/search${qs ? '?' + qs : ''}`, payload || {});
    },

    upsert(entityKey, payload) {
      return api('POST', `${entityPath(entityKey)}/upsert`, payload);
    },

    clone(entityKey, id, payload) {
      return api('POST', `${entityPath(entityKey)}/${id}/clone`, payload || {});
    },

    moveTask(id, payload) {
      return api('POST', `${base}/entities/tasks/${id}/move`, payload);
    },

    transition(entityKey, payload) {
      return api('POST', `${entityPath(entityKey)}/transition`, payload);
    },

    subscribe(body) {
      return api('POST', `${base}/triggers/subscribe`, body);
    },

    unsubscribe(body) {
      return api('POST', `${base}/triggers/unsubscribe`, body);
    },

    unsubscribeById(id) {
      return api('DELETE', `${base}/triggers/${id}`);
    },
  };
}

function normalizeFields(schemaResponse) {
  const input = (schemaResponse && schemaResponse.inputFields) || [];
  const output = (schemaResponse && schemaResponse.outputFields) || [];
  return {
    entityKey: schemaResponse && schemaResponse.entityKey,
    operation: schemaResponse && schemaResponse.operation,
    refreshSchema: !!(schemaResponse && schemaResponse.refreshSchema),
    workflowAppId: schemaResponse && schemaResponse.workflowAppId,
    inputFields: input,
    outputFields: output,
    customFields: (schemaResponse && schemaResponse.customFields) || [],
  };
}

function unwrapData(response) {
  if (!response || typeof response !== 'object') {
    return response;
  }
  if (Object.prototype.hasOwnProperty.call(response, 'entities')) {
    return response.entities;
  }
  if (Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
}

module.exports = {
  createCeloxisAdapter,
  normalizeFields,
  unwrapData,
};
