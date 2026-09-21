// n8n-only mapping over /api/integrations/v1 via the common adapter.
// No Celoxis business rules. Node params / webhooks ↔ adapter only.

'use strict';

const { normalizeFields, unwrapData } = require('./lib/celoxisAdapter');
const core = require('./lib/mappingCore');

const SAMPLE = core.SAMPLE;

const WRITE_OPS = ['create', 'update', 'clone', 'upsert', 'transition'];
const ID_OPS = ['get', 'update', 'delete', 'clone', 'move'];
const SCHEMA_OPS = ['create', 'update', 'clone', 'upsert', 'search', 'move', 'transition'];

const operations = [
  {
    name: 'Create Record',
    value: 'create',
    action: 'Create a Celoxis record',
    description: 'Creates a Celoxis record. Choose Type, then fill in the fields Celoxis returns.',
  },
  {
    name: 'Update Record',
    value: 'update',
    action: 'Update a Celoxis record',
    description: 'Updates a Celoxis record. Choose Type and ID, then fill in fields to change.',
  },
  {
    name: 'Get Record',
    value: 'get',
    action: 'Get a Celoxis record',
    description: 'Gets one Celoxis record by Type and numeric ID.',
  },
  {
    name: 'Find Records',
    value: 'search',
    action: 'Find Celoxis records',
    description: 'Finds Celoxis records. Choose Type, then optional filters from Celoxis.',
  },
  {
    name: 'Upsert Record',
    value: 'upsert',
    action: 'Upsert a Celoxis record',
    description: 'Creates or updates a Celoxis record. Type list comes from Celoxis (unsupported types are omitted).',
  },
  {
    name: 'Clone Record',
    value: 'clone',
    action: 'Clone a Celoxis record',
    description: 'Clones an existing Celoxis record using Celoxis clone (not Get + Create).',
  },
  {
    name: 'Delete Record',
    value: 'delete',
    action: 'Delete a Celoxis record',
    description: 'Deletes a Celoxis record. Choose Type and ID. Only types Celoxis allows appear in Type.',
  },
  {
    name: 'Move Task',
    value: 'move',
    action: 'Move a task',
    description: 'Moves a task to another project, optionally under a parent task.',
  },
  {
    name: 'Do State Transition',
    value: 'transition',
    action: 'Do state transition',
    description: 'Runs a workflow transition (Approve, Reject, …) on a custom app record.',
  },
];

const triggerEvents = [
  {
    name: 'Record Created',
    value: 'created',
    action: 'On record created',
    description: 'Triggers when a Celoxis record is created. Choose Type first.',
  },
  {
    name: 'Record Updated',
    value: 'updated',
    action: 'On record updated',
    description: 'Triggers when a Celoxis record is updated. Choose Type first.',
  },
];

const needsId = (operation) => ID_OPS.indexOf(operation) !== -1;

const mapN8nType = (t) => {
  const s = (t || 'string').toLowerCase();
  if (s === 'integer' || s === 'int' || s === 'decimal' || s === 'number') {
    return 'number';
  }
  if (s === 'boolean' || s === 'bool') {
    return 'boolean';
  }
  if (s === 'datetime' || s === 'date') {
    return 'dateTime';
  }
  if (s === 'options' || s === 'choice') {
    return 'options';
  }
  if (s === 'file') {
    return 'string';
  }
  return 'string';
};

const mapResourceMapperType = (field) => {
  if (field && field.multiple) {
    return 'array';
  }
  // Reference IDs are often set via expression (e.g. {{ $json.id }}). Mapping them as
  // "options" can leave n8n's "=" expression prefix on the resolved value ("=2").
  if (field && (field.type === 'reference' || (field.reference && field.reference.entityKey))) {
    return 'string';
  }
  const t = mapN8nType(field && field.type);
  if (t === 'string' && field && field.options) {
    const src = field.options.source;
    const hasInline = Array.isArray(field.options.values) && field.options.values.length > 0;
    if (src === 'inline' || hasInline) {
      return 'options';
    }
  }
  return t;
};

/**
 * n8n stores expressions as "={{ ... }}". If a nested resource-mapper value is only
 * partially resolved, we can receive leftovers like "=2". Strip that for API calls.
 */
const normalizeN8nValue = (val) => {
  if (typeof val !== 'string') {
    return val;
  }
  const s = val.trim();
  if (s.charAt(0) !== '=') {
    return val;
  }
  if (s.startsWith('={{')) {
    return val;
  }
  const rest = s.slice(1);
  if (/^-?\d+(\.\d+)?$/.test(rest)) {
    return Number(rest);
  }
  return rest;
};

const toOptions = (options) => {
  const entries = core.optionEntries(options);
  if (!entries) {
    return undefined;
  }
  return entries.map((e) => ({ name: String(e.label), value: e.value }));
};

const flattenFields = (fields) => {
  if (!fields) {
    return {};
  }
  if (fields.value && typeof fields.value === 'object' && !Array.isArray(fields.value)) {
    return normalizeN8nValues(Object.assign({}, fields.value));
  }
  if (Array.isArray(fields.fieldValues)) {
    const out = {};
    fields.fieldValues.forEach((row) => {
      if (row && row.fieldId != null) {
        out[row.fieldId] = normalizeN8nValue(row.fieldValue);
      }
    });
    return out;
  }
  return normalizeN8nValues(Object.assign({}, fields));
};

const normalizeN8nValues = (obj) => {
  const out = {};
  Object.keys(obj || {}).forEach((key) => {
    out[key] = normalizeN8nValue(obj[key]);
  });
  return out;
};

/** Resource Mapper stores values under fields — merge for schema refresh (§8.4). */
const schemaValues = (inputData) => {
  const raw = inputData || {};
  return core.schemaValues(raw, { merge: flattenFields(raw.fields) });
};

const buildWritePayload = (inputData, schema) =>
  core.buildWritePayload(inputData, schema, { normalizeValue: normalizeN8nValue });

const buildSearchPayload = (inputData, opts) =>
  core.buildSearchPayload(
    inputData,
    Object.assign({ normalizeValue: normalizeN8nValue }, opts || {})
  );

/** Safe default when field is unknown — never offer text ops like Contains for IDs. */
const defaultSearchOperatorOptions = () =>
  core.operatorChoices({ operators: ['eq', 'neq', 'blank', 'not_blank'] }).map((c) => ({
    name: c.label,
    value: c.value,
  }));

/** Field list for Find → Filters fixedCollection. */
const getSearchFilterFields = async (adapter, entityKey) => {
  if (!entityKey) {
    return [];
  }
  const schema = normalizeFields(
    await adapter.schema(entityKey, { operation: 'search', values: {} })
  );
  return (schema.inputFields || [])
    .filter((f) => f && f.key)
    .map((f) => ({
      name: f.label || f.key,
      value: f.key,
    }));
};

/**
 * Operators for a search field from schema.operators (Java).
 * Unknown field → equals-style only (not the full catalog).
 */
const getSearchFilterOperators = async (adapter, entityKey, fieldKey) => {
  if (!entityKey || !fieldKey) {
    return defaultSearchOperatorOptions();
  }
  try {
    const schema = normalizeFields(
      await adapter.schema(entityKey, { operation: 'search', values: {} })
    );
    const field = (schema.inputFields || []).find(
      (f) => f && (f.key === fieldKey || f.label === fieldKey)
    );
    if (field) {
      return core.operatorChoices(field).map((c) => ({ name: c.label, value: c.value }));
    }
  } catch (e) {
    // fall through
  }
  return defaultSearchOperatorOptions();
};

/** Allowed operators + types from search schema (for encode validation + dropdowns). */
const searchFieldMeta = async (adapter, entityKey) => {
  const schema = normalizeFields(
    await adapter.schema(entityKey, { operation: 'search', values: {} })
  );
  return core.searchMetaFromSchema(schema);
};

const requireEntityKey = (entityKey, operation) => {
  if (operation === 'move') {
    return 'tasks';
  }
  if (!entityKey) {
    throw new Error('Type is required');
  }
  return entityKey;
};

const toResourceMapperField = (field) => {
  const key = field.key || field.path;
  // Match columns: id, or schema primary (upsert sets primary on externalKey).
  const matchKey = !!(field.primary || key === 'id');
  const mapped = {
    id: key,
    displayName: field.label || field.key,
    required: !!field.required,
    defaultMatch: matchKey,
    display: true,
    type: mapResourceMapperType(field),
    canBeUsedToMatch: matchKey,
  };
  if (field.helpText) {
    mapped.description = field.helpText;
  }
  const inline = field.options && field.options.source === 'inline' ? toOptions(field.options) : undefined;
  if (inline) {
    mapped.options = inline;
    mapped.type = 'options';
  }
  return mapped;
};

const toN8nProperty = (field) => {
  const property = {
    displayName: field.label || field.key,
    name: field.key || field.path,
    type: mapN8nType(field.type),
    required: !!field.required,
    default: field.multiple ? [] : '',
    description: field.helpText || '',
  };
  if (field.multiple) {
    property.typeOptions = { multipleValues: true };
  }
  const inline = field.options && field.options.source === 'inline' ? toOptions(field.options) : undefined;
  if (inline) {
    property.type = 'options';
    property.options = inline;
  }
  return property;
};

const attachRemoteChoices = async (adapter, entityKey, fields, operation, values) => {
  const jobs = fields.map(async (field) => {
    const mapped = toResourceMapperField(field);
    const remote = field.options && field.options.source === 'remote';
    if (!remote) {
      return mapped;
    }
    try {
      const data = await adapter.options(entityKey, field.key, {
        operation: operation,
        values: schemaValues(values),
        limit: 50,
      });
      const choices = toOptions((data && data.options) || data);
      if (choices) {
        mapped.options = choices;
        mapped.type = 'options';
      }
    } catch (e) {
      return mapped;
    }
    return mapped;
  });
  return Promise.all(jobs);
};

const getEntityOptions = async (adapter, query) => {
  const res = await adapter.listEntities(query || {});
  const rows = core.unwrapList(res);
  return rows
    .filter((e) => e && e.key)
    .map((e) => ({
      name: e.pluralLabel || e.label || e.key,
      value: e.key,
    }));
};

const getMappingColumns = async (adapter, entityKey, operation, values) => {
  if (!entityKey) {
    return { fields: [] };
  }
  const schema = normalizeFields(
    await adapter.schema(entityKey, {
      operation: operation || 'create',
      values: schemaValues(values),
    })
  );
  let fields = schema.inputFields || [];
  if (needsId(operation)) {
    fields = fields.filter((f) => f.key !== 'id');
  }
  // n8n: recordId / transitionId are top-level for transition (Resource Mapper does not cascade).
  if (operation === 'transition') {
    fields = fields.filter((f) => f.key !== 'recordId' && f.key !== 'transitionId' && f.key !== 'transition');
  }
  const mapped = await attachRemoteChoices(adapter, entityKey, fields, operation, values);
  return { fields: mapped };
};

/** Shared transition dropdown (action cascade + trigger filter). */
const getTransitionOptions = async (adapter, entityKey, recordId) => {
  if (!entityKey) {
    return [];
  }
  try {
    const values = {};
    if (recordId !== undefined && recordId !== null && recordId !== '') {
      values.recordId = recordId;
    }
    const data = await adapter.options(entityKey, 'transitionId', {
      operation: values.recordId ? 'transition' : 'get',
      values: values,
    });
    return toOptions((data && data.options) || data || []) || [];
  } catch (e) {
    return [];
  }
};

const getTriggerTransitionOptions = async (adapter, entityKey) => {
  if (!core.isAppUpdateEntity(entityKey)) {
    return [];
  }
  return getTransitionOptions(adapter, entityKey);
};

const getInputProperties = async (adapter, entityKey, operation, values) => {
  const columns = await getMappingColumns(adapter, entityKey, operation, values);
  return (columns.fields || []).map((f) => {
    const property = {
      displayName: f.displayName,
      name: f.id,
      type: f.type === 'options' ? 'options' : f.type === 'array' ? 'string' : f.type || 'string',
      required: !!f.required,
      default: f.type === 'array' ? [] : '',
      description: f.description || '',
    };
    if (f.options) {
      property.options = f.options;
    }
    if (f.type === 'array') {
      property.typeOptions = { multipleValues: true };
    }
    return property;
  });
};

const withSchemaPayload = async (adapter, entityKey, operation, values, writer) => {
  const schema = normalizeFields(
    await adapter.schema(entityKey, {
      operation: operation,
      values: schemaValues(values),
    })
  );
  return writer(entityKey, buildWritePayload(values, schema));
};

const executeItem = async (adapter, operation, params) => {
  const entityKey = requireEntityKey(params.entityKey, operation);
  const id = params.id;
  const values = Object.assign({}, flattenFields(params.fields), schemaValues(params));

  if (operation === 'delete') {
    const res = unwrapData(await adapter.delete(entityKey, id));
    return res || { id: id, success: true };
  }
  if (operation === 'get') {
    return core.unwrapRecord(await adapter.get(entityKey, id));
  }
  if (operation === 'search') {
    const searchValues = Object.assign({}, flattenFields(params.fields), schemaValues(params));
    if (params.searchFilters) {
      searchValues.searchFilters = params.searchFilters;
    }
    const meta = await searchFieldMeta(adapter, entityKey);
    return core.unwrapList(
      await adapter.search(
        entityKey,
        buildSearchPayload(searchValues, {
          allowedOperators: meta.allowedOperators,
          fieldTypes: meta.fieldTypes,
        })
      )
    );
  }
  if (operation === 'clone') {
    return withSchemaPayload(adapter, entityKey, 'clone', values, async (key, payload) => {
      delete payload.id;
      return core.unwrapRecord(await adapter.clone(key, id, payload));
    });
  }
  if (operation === 'update') {
    return withSchemaPayload(adapter, entityKey, 'update', values, async (key, payload) => {
      return core.unwrapRecord(await adapter.update(key, id, payload));
    });
  }
  if (operation === 'upsert') {
    return withSchemaPayload(adapter, entityKey, 'upsert', values, async (key, payload) => {
      return core.unwrapRecord(await adapter.upsert(key, payload));
    });
  }
  if (operation === 'move') {
    // Java moveTask coerces {data:{id}} — no schema round-trip needed.
    const payload = Object.assign({}, values);
    delete payload.id;
    delete payload.entityKey;
    const res = unwrapData(await adapter.moveTask(id, payload));
    return res || { id: id, success: true };
  }
  if (operation === 'transition') {
    return withSchemaPayload(adapter, entityKey, 'transition', values, async (key, payload) => {
      return core.unwrapRecord(await adapter.transition(key, payload));
    });
  }
  return withSchemaPayload(adapter, entityKey, 'create', values, async (key, payload) => {
    return core.unwrapRecord(await adapter.create(key, payload));
  });
};

const toN8nItems = (result) => {
  const rows = result == null ? [] : Array.isArray(result) ? result : [result];
  return rows.map((json) => ({ json: json && typeof json === 'object' ? json : { value: json } }));
};

const subscribe = (adapter, entityKey, event, targetUrl, expand, transitionId) => {
  const body = {
    entityKey: entityKey,
    event: event,
    targetUrl: targetUrl,
    expand: expand,
  };
  if (transitionId !== undefined && transitionId !== null && transitionId !== '') {
    body.transitionId = transitionId;
  }
  return adapter.subscribe(body);
};

const unsubscribe = (adapter, id) => {
  return adapter.unsubscribe({ id: id }).then(() => ({ id: id }));
};

const parseWebhookBody = (body) => {
  if (Array.isArray(body)) {
    return body;
  }
  if (body && typeof body === 'object') {
    if (Array.isArray(body.data)) {
      return body.data.length ? body.data : [SAMPLE];
    }
    return [body];
  }
  if (typeof body === 'string' && body) {
    try {
      const parsed = JSON.parse(body);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      return [SAMPLE];
    }
  }
  return [SAMPLE];
};

/** Reports that reject sort=id: taskUpdates uses date; expenses uses created. */
const sampleSort = (entityKey) => {
  if (entityKey === 'taskUpdates') return 'date/desc';
  if (entityKey === 'expenses') return 'created/desc';
  return 'id/desc';
};

const loadSampleRecords = async (adapter, entityKey, transitionId) => {
  if (!entityKey) {
    return [SAMPLE];
  }
  const filter = {};
  if (transitionId !== undefined && transitionId !== null && transitionId !== '') {
    filter.transitionId = transitionId;
  }
  const rows = core.unwrapList(
    await adapter.search(entityKey, { filter: filter }, { sort: sampleSort(entityKey), limit: 10 })
  );
  const samples = core.newestSamples(rows, 3);
  return samples.length ? samples : [SAMPLE];
};

const resourceMapperProperty = (mode, showOps, extras) => {
  const opts = extras || {};
  return {
    displayName: 'Fields',
    name: 'fields',
    type: 'resourceMapper',
    noDataExpression: true,
    default: {
      mappingMode: 'defineBelow',
      value: null,
    },
    typeOptions: {
      loadOptionsDependsOn: opts.loadOptionsDependsOn || ['entityKey', 'operation', 'id', 'fields'],
      resourceMapper: {
        resourceMapperMethod: 'getMappingColumns',
        mode: mode,
        fieldWords: { singular: 'field', plural: 'fields' },
        addAllFields: true,
        multiKeyMatch: false,
        supportAutoMap: opts.supportAutoMap !== undefined ? opts.supportAutoMap : true,
      },
    },
    displayOptions: {
      show: {
        operation: showOps,
      },
    },
  };
};

const actionProperties = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    options: operations,
    default: 'create',
  },
  {
    displayName: 'Type',
    name: 'entityKey',
    type: 'options',
    required: true,
    default: '',
    description: 'Celoxis record type. List comes from Celoxis for the selected operation.',
    typeOptions: {
      loadOptionsMethod: 'getEntityKeys',
      loadOptionsDependsOn: ['operation'],
    },
    displayOptions: {
      show: {
        operation: ['create', 'update', 'get', 'search', 'upsert', 'clone', 'delete', 'transition'],
      },
    },
  },
  {
    displayName: 'ID',
    name: 'id',
    type: 'number',
    required: true,
    default: 0,
    description: 'Numeric Celoxis record id.',
    displayOptions: {
      show: {
        operation: ['get', 'update', 'delete', 'clone'],
      },
    },
  },
  {
    displayName: 'Task ID',
    name: 'id',
    type: 'number',
    required: true,
    default: 0,
    description: 'Numeric Celoxis task id to move.',
    displayOptions: {
      show: {
        operation: ['move'],
      },
    },
  },
  resourceMapperProperty('add', ['create', 'clone']),
  // Same pattern as Move: cascade keys outside Resource Mapper so n8n reloads options.
  {
    displayName: 'Record ID',
    name: 'recordId',
    type: 'number',
    required: true,
    default: 0,
    description: 'Workflow app record id (e.g. Approval id).',
    displayOptions: {
      show: {
        operation: ['transition'],
      },
    },
  },
  {
    displayName: 'Transition',
    name: 'transitionId',
    type: 'options',
    required: true,
    default: '',
    description: 'Allowed for this record’s current state.',
    typeOptions: {
      loadOptionsMethod: 'getTransitionOptions',
      loadOptionsDependsOn: ['entityKey', 'recordId'],
    },
    displayOptions: {
      show: {
        operation: ['transition'],
      },
    },
  },
  resourceMapperProperty('add', ['transition'], {
    supportAutoMap: false,
    loadOptionsDependsOn: ['entityKey', 'operation', 'recordId', 'transitionId', 'fields'],
  }),
  resourceMapperProperty('add', ['move'], {
    loadOptionsDependsOn: ['operation', 'id', 'fields'],
  }),
  resourceMapperProperty('update', ['update']),
  resourceMapperProperty('upsert', ['upsert']),
  // Find: Operator + Value rows (Celoxis filter expressions). Do not use resourceMapper
  // options for StringFilter templates (">", "=") — those blocked entering a value.
  {
    displayName: 'Filters',
    name: 'searchFilters',
    type: 'fixedCollection',
    placeholder: 'Add Filter',
    default: {},
    typeOptions: {
      multipleValues: true,
    },
    description:
      'Add one or more conditions. Choose Operator (Equals, Greater than, Is Blank, …) then enter Value when needed.',
    options: [
      {
        name: 'conditions',
        displayName: 'Condition',
        values: [
          {
            displayName: 'Field',
            name: 'field',
            type: 'options',
            required: true,
            default: '',
            typeOptions: {
              loadOptionsMethod: 'getSearchFilterFields',
              loadOptionsDependsOn: ['entityKey'],
            },
          },
          {
            displayName: 'Operator',
            name: 'operator',
            type: 'options',
            required: true,
            default: 'eq',
            description: 'Equals, Greater than, Is Blank, … — then set Value when the operator needs one.',
            typeOptions: {
              loadOptionsMethod: 'getSearchFilterOperators',
              loadOptionsDependsOn: ['entityKey', 'searchFilters.conditions.field'],
            },
          },
          {
            displayName: 'Value',
            name: 'value',
            type: 'string',
            default: '',
            description:
              'Compare value (e.g. 2 or Project name). Dates: yyyy-MM-dd (e.g. 2026-07-14). Leave empty for Is Blank / Is Not Blank.',
          },
        ],
      },
    ],
    displayOptions: {
      show: {
        operation: ['search'],
      },
    },
  },
];

const triggerProperties = [
  {
    displayName: 'Event',
    name: 'event',
    type: 'options',
    noDataExpression: true,
    options: triggerEvents,
    default: 'created',
  },
  {
    displayName: 'Type',
    name: 'entityKey',
    type: 'options',
    required: true,
    default: '',
    description: 'Celoxis record type. List comes from Celoxis for the selected event.',
    typeOptions: {
      loadOptionsMethod: 'getTriggerEntityKeys',
      loadOptionsDependsOn: ['event'],
    },
  },
  {
    displayName: 'Transition',
    name: 'transitionId',
    type: 'options',
    required: false,
    default: '',
    description:
      'Optional. Only for workflow app Updates types (e.g. Approvals Updates). Limits the trigger to that transition.',
    typeOptions: {
      loadOptionsMethod: 'getTriggerTransitions',
      loadOptionsDependsOn: ['entityKey'],
    },
    // Same rule as Zapier / backend: transition filter only applies to appUpdates:{id}.
    displayOptions: {
      show: {
        entityKey: [{ _cnd: { startsWith: 'appUpdates:' } }],
      },
    },
  },
];

const webhookConfig = [
  {
    name: 'default',
    httpMethod: 'POST',
    responseMode: 'onReceived',
    path: 'webhook',
  },
];

module.exports = {
  SAMPLE,
  WRITE_OPS,
  ID_OPS,
  SCHEMA_OPS,
  operations,
  triggerEvents,
  needsId,
  mapN8nType,
  toOptions,
  toN8nProperty,
  toResourceMapperField,
  schemaValues,
  flattenFields,
  buildWritePayload,
  buildSearchPayload,
  getEntityOptions,
  getMappingColumns,
  getInputProperties,
  getTransitionOptions,
  getSearchFilterFields,
  getSearchFilterOperators,
  searchFieldMeta,
  executeItem,
  toN8nItems,
  subscribe,
  unsubscribe,
  parseWebhookBody,
  loadSampleRecords,
  getTriggerTransitionOptions,
  actionProperties,
  triggerProperties,
  webhookConfig,
};
