/**
 * Shared mapping helpers for Zapier + n8n (payloads, unwrap, samples).
 * Platform UI / SDK code stays in each wrapper's mapping.js.
 * No Zapier or n8n SDK imports here.
 */

'use strict';

const { unwrapData } = require('./celoxisAdapter');

const SAMPLE = { id: 1, name: 'Sample' };

const DEFAULT_STRIP = ['entityKey', 'operation', 'event', 'fields', 'searchFilters', 'page', 'limit', 'sort'];

/**
 * Celoxis report filter expression operators (POPredicate).
 * Schema advertises op ids; platforms show labels; encode → API string.
 */
const FILTER_OPERATORS = [
  { id: 'eq', label: 'Equals', prefix: '=', needsValue: true },
  { id: 'neq', label: 'Not Equals', prefix: '!', needsValue: true },
  { id: 'gt', label: 'Greater than', prefix: '>', needsValue: true },
  { id: 'gte', label: 'Greater equals', prefix: '>=', needsValue: true },
  { id: 'lt', label: 'Less than', prefix: '<', needsValue: true },
  { id: 'lte', label: 'Less equals', prefix: '<=', needsValue: true },
  { id: 'contains', label: 'Contains', prefix: '~', needsValue: true },
  { id: 'not_contains', label: 'Not Contains', prefix: '!~', needsValue: true },
  { id: 'starts_with', label: 'Starts with', prefix: '^', needsValue: true },
  { id: 'ends_with', label: 'Ends with', prefix: '$', needsValue: true },
  { id: 'blank', label: 'Is Blank', prefix: '{}', needsValue: false },
  { id: 'not_blank', label: 'Is Not Blank', prefix: '!{}', needsValue: false },
];

/** Text-pattern ops — invalid for bigint/date columns (Postgres ~~* / similar). */
const STRING_ONLY_OP_IDS = ['contains', 'not_contains', 'starts_with', 'ends_with'];

/** Numeric compare ops — invalid for text columns. */
const COMPARE_ONLY_OP_IDS = ['gt', 'gte', 'lt', 'lte'];

const FILTER_OP_BY_ID = Object.create(null);
FILTER_OPERATORS.forEach((op) => {
  FILTER_OP_BY_ID[op.id] = op;
});

/** Prefixes longest-first so `>=` wins over `>` / `=`. */
const FILTER_PREFIXES = FILTER_OPERATORS.map((op) => op.prefix).sort((a, b) => b.length - a.length);

function isNumericType(type) {
  const t = String(type || '').toLowerCase().replace(/_/g, '');
  return t === 'integer' || t === 'int' || t === 'number' || t === 'decimal';
}

function isNumericOrDateType(type) {
  return isNumericType(type) || isDateType(type);
}

function isDateType(type) {
  const t = String(type || '').toLowerCase().replace(/_/g, '');
  return t === 'date' || t === 'datetime' || t === 'datetimezone';
}

function isTextType(type) {
  const t = String(type || '').toLowerCase();
  return t === 'string' || t === 'text' || t === 'unicode';
}

function defaultOperatorIdsForType(type) {
  if (isDateType(type)) {
    // DateRangeFilter: bare date / >date / >=date only.
    return ['eq', 'gt', 'gte'];
  }
  if (isPickerType(type)) {
    // ChoiceFilter: raw selected id — Equals only.
    return ['eq'];
  }
  if (isBooleanType(type)) {
    return ['eq', 'neq'];
  }
  if (isNumericType(type)) {
    return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'blank', 'not_blank'];
  }
  if (isTextType(type)) {
    return ['eq', 'neq', 'contains', 'not_contains', 'starts_with', 'ends_with', 'blank', 'not_blank'];
  }
  return ['eq', 'neq', 'blank', 'not_blank'];
}

/**
 * Effective type for operator UI / encode — id & primary are always numeric.
 * Prefers Celoxis filter operators over a wrong Zapier column type.
 * @param {object} [field]
 */
function effectiveFieldType(field) {
  if (!field) {
    return '';
  }
  const key = String(field.key || '').toLowerCase();
  if (field.primary || key === 'id') {
    return 'integer';
  }
  const ops = Array.isArray(field.operators) ? field.operators : [];
  const hasString = ops.some((id) => STRING_ONLY_OP_IDS.indexOf(id) !== -1);
  const hasCompare = ops.some((id) => COMPARE_ONLY_OP_IDS.indexOf(id) !== -1);
  if (isDateType(field.type)) {
    return field.type;
  }
  if (isPickerType(field.type) || isBooleanType(field.type)) {
    return field.type;
  }
  if (isNumericType(field.type)) {
    return field.type;
  }
  // Column typed as string but filter ops are numeric (or vice versa).
  if (hasCompare && !hasString) {
    return 'number';
  }
  if (hasString && !hasCompare) {
    return 'string';
  }
  if (field.type) {
    return field.type;
  }
  if (hasString) {
    return 'string';
  }
  if (hasCompare) {
    return 'number';
  }
  return '';
}

/**
 * Type-first operator list: numbers → numeric only; text → Contains… (no gt/lt); dates → eq/gt/gte.
 * Schema.operators may narrow the list, never expand past the type-safe set.
 * @param {object} field
 */
function operatorsForField(field) {
  const type = effectiveFieldType(field);
  let ids = defaultOperatorIdsForType(type);
  if (field && Array.isArray(field.operators) && field.operators.length) {
    const allowed = Object.create(null);
    field.operators.forEach((id) => {
      allowed[id] = true;
    });
    const narrowed = ids.filter((id) => allowed[id]);
    if (narrowed.length) {
      ids = narrowed;
    }
  }
  // Hard guards (schema type wrong / stale operators).
  if (!isNumericOrDateType(type)) {
    ids = ids.filter((id) => COMPARE_ONLY_OP_IDS.indexOf(id) === -1);
  }
  if (isNumericOrDateType(type) || (field && field.primary) || String((field && field.key) || '').toLowerCase() === 'id') {
    ids = ids.filter((id) => STRING_ONLY_OP_IDS.indexOf(id) === -1);
  }
  if (isDateType(type)) {
    ids = ids.filter((id) => ['eq', 'gt', 'gte'].indexOf(id) !== -1);
  }
  if (isPickerType(type)) {
    ids = ids.filter((id) => id === 'eq');
  }
  if (isBooleanType(type)) {
    ids = ids.filter((id) => id === 'eq' || id === 'neq');
  }
  return ids.map((id) => FILTER_OP_BY_ID[id]).filter(Boolean);
}

/**
 * Zapier/n8n choices: [{ value, label }].
 * @param {object} field
 */
function operatorChoices(field) {
  return operatorsForField(field).map((op) => ({ value: op.id, label: op.label }));
}

/**
 * @param {string} [opId]
 * @param {string[]} [allowedIds]
 * @param {string} [fieldKey]
 * @param {string} [fieldType]
 */
function assertOperatorAllowed(opId, allowedIds, fieldKey, fieldType) {
  const op = opId || 'eq';
  const key = String(fieldKey || '').toLowerCase();
  const type =
    key === 'id' ? 'integer' : fieldType;
  if (COMPARE_ONLY_OP_IDS.indexOf(op) !== -1 && !isNumericOrDateType(type)) {
    throw new Error(
      'Operator "' +
        ((FILTER_OP_BY_ID[op] && FILTER_OP_BY_ID[op].label) || op) +
        '" is only for number/date fields, not text "' +
        (fieldKey || 'this field') +
        '".'
    );
  }
  // Text-pattern ops must never hit numeric/date columns (Postgres bigint ~~* …).
  if (STRING_ONLY_OP_IDS.indexOf(op) !== -1) {
    if (isNumericOrDateType(type) || key === 'id') {
      throw new Error(
        'Operator "' +
          ((FILTER_OP_BY_ID[op] && FILTER_OP_BY_ID[op].label) || op) +
          '" is only for text fields (Name, …), not "' +
          (fieldKey || 'this field') +
          '". Use Equals / Greater than / Less than instead.'
      );
    }
  }
  // DateRangeFilter: Equals / Greater than / Greater equals only.
  if (isDateType(type) && ['eq', 'gt', 'gte'].indexOf(op) === -1) {
    throw new Error(
      'Operator "' +
        ((FILTER_OP_BY_ID[op] && FILTER_OP_BY_ID[op].label) || op) +
        '" is not valid for date "' +
        (fieldKey || 'this field') +
        '". Use: Equals, Greater than, Greater equals.'
    );
  }
  if (allowedIds && allowedIds.length && allowedIds.indexOf(op) === -1) {
    const labels = allowedIds
      .map((id) => (FILTER_OP_BY_ID[id] && FILTER_OP_BY_ID[id].label) || id)
      .join(', ');
    throw new Error(
      'Operator "' +
        ((FILTER_OP_BY_ID[op] && FILTER_OP_BY_ID[op].label) || op) +
        '" is not valid for "' +
        fieldKey +
        '". Use: ' +
        labels
    );
  }
}

/**
 * Shared search meta for Zapier + n8n — same operators + types for encode/validate.
 * @param {object} [schema]
 * @returns {{ allowedOperators: object, fieldTypes: object }}
 */
function searchMetaFromSchema(schema) {
  const allowedOperators = Object.create(null);
  const fieldTypes = Object.create(null);
  ((schema && schema.inputFields) || []).forEach((f) => {
    if (!f || !f.key) {
      return;
    }
    fieldTypes[f.key] = effectiveFieldType(f) || f.type || '';
    const ops = operatorsForField(f).map((op) => op.id);
    allowedOperators[f.key] = ops.length ? ops : ['eq'];
  });
  return { allowedOperators, fieldTypes };
}

/**
 * @param {object} [inputData]
 * @param {{ merge?: object, strip?: string[] }} [opts]
 */
function schemaValues(inputData, opts) {
  const options = opts || {};
  const values = Object.assign({}, inputData || {}, options.merge || {});
  (options.strip || DEFAULT_STRIP).forEach((key) => {
    delete values[key];
  });
  return values;
}

/**
 * Get/Search return associations as `{ data: { id } }`. Map Automatically copies that
 * shape into Create and Celoxis rejects it — unwrap to the bare id (arrays too).
 * @param {*} val
 */
function coerceAssociationId(val) {
  if (Array.isArray(val)) {
    return val.map(coerceAssociationId);
  }
  if (val == null || typeof val !== 'object') {
    return val;
  }
  const data = val.data;
  if (data && typeof data === 'object' && !Array.isArray(data) && data.id != null && data.id !== '') {
    return data.id;
  }
  return val;
}

/**
 * @param {object} [inputData]
 * @param {object} [schema]
 * @param {{ normalizeValue?: (v:any)=>any, skipKeys?: string[] }} [opts]
 */
function buildWritePayload(inputData, schema, opts) {
  const options = opts || {};
  const normalize = options.normalizeValue || ((v) => v);
  const skip = Object.create(null);
  (options.skipKeys || DEFAULT_STRIP).forEach((k) => {
    skip[k] = true;
  });
  const byKey = Object.create(null);
  ((schema && schema.inputFields) || []).forEach((f) => {
    byKey[f.key] = f;
  });
  const customFields = {};
  const body = {};
  Object.keys(inputData || {}).forEach((key) => {
    if (skip[key] || key.endsWith('__op')) {
      return;
    }
    const val = coerceAssociationId(normalize(inputData[key]));
    if (val === undefined || val === '') {
      return;
    }
    const meta = byKey[key];
    if (meta && meta.custom) {
      customFields[key] = val;
    } else {
      body[key] = val;
    }
  });
  if (Object.keys(customFields).length) {
    body.customFields = customFields;
  }
  return body;
}

/**
 * True when string already looks like a Celoxis filter expression.
 * @param {string} s
 */
function looksLikeFilterExpression(s) {
  if (typeof s !== 'string') {
    return false;
  }
  const t = s.trim();
  if (!t) {
    return false;
  }
  return FILTER_PREFIXES.some((p) => t === p || t.startsWith(p));
}

function isBooleanType(type) {
  const t = String(type || '').toLowerCase();
  return t === 'boolean' || t === 'bool';
}

function isPickerType(type) {
  const t = String(type || '').toLowerCase();
  return t === 'enum' || t === 'reference' || t === 'options';
}

/**
 * Encode operator + value to Celoxis filter expression.
 * Numbers/text: "=5", "~foo". Dates: bare / > / >=. Enum/reference/boolean: bare id (ChoiceFilter rejects "=1").
 * @param {string} [opId]
 * @param {*} value
 * @param {{ normalizeValue?: (v:any)=>any, fieldType?: string }} [opts]
 * @returns {string|undefined}
 */
function encodeFilterExpression(opId, value, opts) {
  const normalize = (opts && opts.normalizeValue) || ((v) => v);
  const fieldType = opts && opts.fieldType;
  const op = FILTER_OP_BY_ID[opId] || FILTER_OP_BY_ID.eq;
  if (!op.needsValue) {
    // blank/not_blank are for StringFilter / numeric POPredicate — not ChoiceFilter.
    if (isPickerType(fieldType) || isBooleanType(fieldType)) {
      return undefined;
    }
    return op.prefix;
  }
  let val = normalize(value);
  if (val === undefined || val === null || val === '') {
    return undefined;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (FILTER_PREFIXES.indexOf(trimmed) !== -1) {
      return undefined;
    }
    // Full expression typed by user (">5") — keep, except date/picker "=" which APIs reject.
    if (looksLikeFilterExpression(trimmed)) {
      if (
        (isDateType(fieldType) || isPickerType(fieldType) || isBooleanType(fieldType)) &&
        (trimmed.charAt(0) === '=' || trimmed.charAt(0) === '~')
      ) {
        val = trimmed.replace(/^[=~!\s]+/, '');
      } else {
        return trimmed;
      }
    } else {
      val = trimmed;
    }
  }
  // DateRangeFilter: equals = bare date; compares use > >=.
  if (isDateType(fieldType)) {
    const dateVal = String(val).replace(/^[=~!\s]+/, '');
    if (op.id === 'eq') {
      return dateVal;
    }
    if (op.id === 'gt' || op.id === 'gte' || op.id === 'lt' || op.id === 'lte') {
      return op.prefix + dateVal;
    }
    return dateVal;
  }
  // ChoiceFilter / reference / boolean: raw selected value (getIntList / getBoolList).
  if (isPickerType(fieldType) || isBooleanType(fieldType)) {
    return String(val).replace(/^[=~!\s]+/, '');
  }
  return op.prefix + String(val);
}

/**
 * Build search filter object from flat input (`id` + `id__op`) and/or condition rows.
 * @param {object} [inputData]
 * @param {{ normalizeValue?: (v:any)=>any, skipKeys?: string[], conditions?: Array<{field,operator,value}>, allowedOperators?: object, fieldTypes?: object }} [opts]
 */
function buildSearchPayload(inputData, opts) {
  const options = opts || {};
  const normalize = options.normalizeValue || ((v) => v);
  const skip = Object.create(null);
  (options.skipKeys || DEFAULT_STRIP).forEach((k) => {
    skip[k] = true;
  });
  const filter = {};
  const data = inputData || {};

  const applyCondition = (fieldKey, opId, rawValue) => {
    if (!fieldKey || skip[fieldKey] || fieldKey.endsWith('__op')) {
      return;
    }
    const op = opId || 'eq';
    const allowed = options.allowedOperators && options.allowedOperators[fieldKey];
    const fieldType = options.fieldTypes && options.fieldTypes[fieldKey];
    assertOperatorAllowed(op, allowed, fieldKey, fieldType);
    const encoded = encodeFilterExpression(op, rawValue, {
      normalizeValue: normalize,
      fieldType: fieldType,
    });
    if (encoded !== undefined && encoded !== null && encoded !== '') {
      const expr = String(encoded).trim();
      if (
        (isNumericOrDateType(fieldType) || String(fieldKey || '').toLowerCase() === 'id') &&
        (expr.startsWith('!~') || expr.startsWith('~') || expr.startsWith('^') || expr.startsWith('$'))
      ) {
        throw new Error(
          'Text pattern filter "' +
            expr +
            '" cannot be used on "' +
            fieldKey +
            '". Use Equals / Greater than / Less than with a number.'
        );
      }
      filter[fieldKey] = encoded;
    }
  };

  // Explicit condition rows (n8n fixedCollection).
  const conditions = options.conditions || data.searchFilters || data.conditions;
  const rows = Array.isArray(conditions)
    ? conditions
    : conditions && Array.isArray(conditions.conditions)
      ? conditions.conditions
      : [];
  rows.forEach((row) => {
    if (!row) {
      return;
    }
    applyCondition(row.field || row.key, row.operator || row.op || 'eq', row.value);
  });

  // Flat fields: name / name__op (Zapier + legacy).
  Object.keys(data).forEach((key) => {
    if (skip[key] || key.endsWith('__op') || key === 'searchFilters' || key === 'conditions') {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(filter, key)) {
      return;
    }
    const opId = data[key + '__op'] || 'eq';
    const raw = data[key];
    // Structured { op, value }.
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && (raw.op || raw.operator || raw.value !== undefined)) {
      applyCondition(key, raw.op || raw.operator || opId, raw.value);
      return;
    }
    applyCondition(key, opId, raw);
  });

  return { filter: filter };
}

function unwrapRecord(res) {
  const data = unwrapData(res);
  if (!data || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data[0];
  }
  // Missing / wrong workflow-type get returns {"data":{}} — treat as no record (Zapier + n8n).
  if (data.id == null && Object.keys(data).length === 0) {
    return undefined;
  }
  return data;
}

function unwrapList(res) {
  const data = unwrapData(res);
  if (!data) {
    return [];
  }
  if (Array.isArray(data)) {
    return data;
  }
  return [data];
}

/** Newest-first samples for trigger polling / "Find new records". */
function newestSamples(rows, limit) {
  const list = (rows || []).slice();
  list.sort((a, b) => (Number(b && b.id) || 0) - (Number(a && a.id) || 0));
  return list.slice(0, limit == null ? 3 : limit);
}

function isAppUpdateEntity(entityKey) {
  return typeof entityKey === 'string' && entityKey.indexOf('appUpdates:') === 0;
}

/**
 * Normalize API / schema option rows to [{ value, label }].
 * Platforms map this to Zapier choices or n8n { name, value }.
 */
function optionEntries(options) {
  if (!options) {
    return undefined;
  }
  const rows = Array.isArray(options) ? options : options.values || [];
  if (!rows.length) {
    return undefined;
  }
  const out = [];
  rows.forEach((row) => {
    if (row && typeof row === 'object') {
      const value = row.value != null ? row.value : row.id;
      if (value != null) {
        out.push({ value: value, label: row.label != null ? row.label : value });
      }
    } else if (row != null) {
      out.push({ value: row, label: row });
    }
  });
  return out.length ? out : undefined;
}

/**
 * Query params for POST .../search (same as /api/v2 list): page, limit, sort.
 * Empty/missing keys are omitted so Java defaults apply.
 */
function searchQueryFromInput(data) {
  const q = {};
  if (!data || typeof data !== 'object') {
    return q;
  }
  if (data.page != null && data.page !== '') {
    const page = Number(data.page);
    if (!Number.isNaN(page) && page > 0) {
      q.page = page;
    }
  }
  if (data.limit != null && data.limit !== '') {
    const limit = Number(data.limit);
    if (!Number.isNaN(limit) && limit > 0) {
      q.limit = limit;
    }
  }
  if (data.sort != null && String(data.sort).trim() !== '') {
    q.sort = String(data.sort).trim();
  }
  return q;
}

module.exports = {
  SAMPLE,
  DEFAULT_STRIP,
  FILTER_OPERATORS,
  schemaValues,
  buildWritePayload,
  coerceAssociationId,
  buildSearchPayload,
  searchQueryFromInput,
  encodeFilterExpression,
  operatorsForField,
  operatorChoices,
  searchMetaFromSchema,
  effectiveFieldType,
  isDateType,
  isNumericType,
  isTextType,
  looksLikeFilterExpression,
  unwrapRecord,
  unwrapList,
  newestSamples,
  isAppUpdateEntity,
  optionEntries,
};
