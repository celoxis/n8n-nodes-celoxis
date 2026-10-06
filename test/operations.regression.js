/**
 * Regression checks for Celoxis n8n operations (C/U/G/F/UP/CL/D/M/T + triggers).
 * Mocks the API adapter — no live Celoxis required.
 * Mirrors the example workflow case families in examples/.
 */
'use strict';

const assert = require('assert');
const path = require('path');

const operations = require(path.join(__dirname, '../dist/nodes/Celoxis/operations'));
const { Celoxis } = require(path.join(__dirname, '../dist/nodes/Celoxis/Celoxis.node'));
const { CeloxisTrigger } = require(path.join(
	__dirname,
	'../dist/nodes/Celoxis/CeloxisTrigger.node',
));
const { CeloxisApi } = require(path.join(
	__dirname,
	'../dist/credentials/CeloxisApi.credentials',
));

let passed = 0;
function ok(name, fn) {
	fn();
	passed += 1;
	console.log('  ✓', name);
}

function mockAdapter(handlers) {
	const calls = [];
	const base = {
		listEntities: async (q) => {
			calls.push(['listEntities', q]);
			return { entities: [{ key: 'projects', label: 'Project', pluralLabel: 'Projects' }] };
		},
		schema: async (entityKey, body) => {
			calls.push(['schema', entityKey, body]);
			return {
				entityKey,
				operation: body && body.operation,
				refreshSchema: false,
				inputFields: [
					{ key: 'name', label: 'Name', type: 'string', required: true },
					{ key: 'id', label: 'ID', type: 'integer', primary: true },
					{ key: 'externalKey', label: 'External Key', type: 'string' },
					{
						key: 'status',
						label: 'Status',
						type: 'string',
						operators: ['eq', 'neq', 'blank', 'not_blank'],
					},
				],
				outputFields: [{ key: 'id', label: 'ID', type: 'integer' }],
			};
		},
		options: async () => ({ options: [{ value: 't1', label: 'Approve' }] }),
		create: async (entityKey, payload) => {
			calls.push(['create', entityKey, payload]);
			return { data: { id: 10, ...payload } };
		},
		get: async (entityKey, lookup) => {
			calls.push(['get', entityKey, lookup]);
			return { data: { id: 1, name: 'Got', ...lookup } };
		},
		update: async (entityKey, id, payload) => {
			calls.push(['update', entityKey, id, payload]);
			return { data: { id, ...payload } };
		},
		delete: async (entityKey, id) => {
			calls.push(['delete', entityKey, id]);
			return { data: { id, success: true } };
		},
		search: async (entityKey, payload, query) => {
			calls.push(['search', entityKey, payload, query]);
			return { data: [{ id: 2, name: 'Found' }] };
		},
		upsert: async (entityKey, payload) => {
			calls.push(['upsert', entityKey, payload]);
			return { data: { id: 3, ...payload } };
		},
		clone: async (entityKey, id, payload) => {
			calls.push(['clone', entityKey, id, payload]);
			return { data: { id: 4, clonedFrom: id, ...payload } };
		},
		moveTask: async (id, payload) => {
			calls.push(['moveTask', id, payload]);
			return { data: { id, ...payload } };
		},
		transition: async (entityKey, payload) => {
			calls.push(['transition', entityKey, payload]);
			return { data: { id: payload.recordId || 5, ...payload } };
		},
		subscribe: async (body) => {
			calls.push(['subscribe', body]);
			return { id: 'sub-1' };
		},
		unsubscribe: async (body) => {
			calls.push(['unsubscribe', body]);
			return { id: body.id };
		},
	};
	return { adapter: Object.assign(base, handlers || {}), calls };
}

async function run() {
	console.log('Package structure');
	ok('Celoxis node class loads', () => {
		const node = new Celoxis();
		assert.strictEqual(node.description.name, 'celoxis');
		assert.ok(Array.isArray(node.description.properties));
		assert.ok(typeof node.execute === 'function');
		assert.ok(node.methods.loadOptions.getEntityKeys);
		assert.ok(node.methods.resourceMapping.getMappingColumns);
	});
	ok('CeloxisTrigger node class loads', () => {
		const node = new CeloxisTrigger();
		assert.strictEqual(node.description.name, 'celoxisTrigger');
		assert.ok(node.webhookMethods.default.create);
		assert.ok(typeof node.webhook === 'function');
	});
	ok('Credentials class loads', () => {
		const creds = new CeloxisApi();
		assert.strictEqual(creds.name, 'celoxisApi');
		assert.ok(creds.authenticate);
		assert.ok(creds.test);
	});

	console.log('\nUI parameter contract (workflow case families)');
	ok('action operations match C/U/G/F/UP/CL/D/M/T', () => {
		const values = operations.operations.map((o) => o.value).sort();
		assert.deepStrictEqual(values, [
			'clone',
			'create',
			'delete',
			'get',
			'move',
			'search',
			'transition',
			'update',
			'upsert',
		]);
	});
	ok('trigger events match TC/TU', () => {
		assert.deepStrictEqual(
			operations.triggerEvents.map((e) => e.value).sort(),
			['created', 'updated'],
		);
	});
	ok('required param names present', () => {
		const names = operations.actionProperties.map((p) => p.name);
		[
			'operation',
			'entityKey',
			'id',
			'fields',
			'recordId',
			'transitionId',
			'searchFilters',
			'page',
			'limit',
			'sort',
		].forEach((n) => assert.ok(names.includes(n), 'missing ' + n));
		const tNames = operations.triggerProperties.map((p) => p.name);
		['event', 'entityKey', 'transitionId'].forEach((n) =>
			assert.ok(tNames.includes(n), 'missing trigger ' + n),
		);
	});

	console.log('\nExecute operations');
	{
		const { adapter, calls } = mockAdapter();
		const res = await operations.executeItem(adapter, 'create', {
			entityKey: 'projects',
			fields: { value: { name: 'INT Project' } },
			input: {},
		});
		ok('C-* create', () => {
			assert.strictEqual(res.name, 'INT Project');
			assert.ok(calls.some((c) => c[0] === 'create'));
		});
	}
	{
		const { adapter, calls } = mockAdapter();
		const res = await operations.executeItem(adapter, 'update', {
			entityKey: 'projects',
			id: 99,
			fields: { value: { name: 'Updated' } },
			input: {},
		});
		ok('U-* update', () => {
			assert.strictEqual(res.id, 99);
			assert.strictEqual(res.name, 'Updated');
			assert.ok(calls.some((c) => c[0] === 'update' && c[2] === 99));
		});
	}
	{
		const { adapter, calls } = mockAdapter();
		const res = await operations.executeItem(adapter, 'get', {
			entityKey: 'projects',
			fields: { value: { id: 7 } },
			input: {},
		});
		ok('G-* get by id', () => {
			assert.strictEqual(res.id, 7);
			assert.ok(calls.some((c) => c[0] === 'get' && c[2].id === 7));
		});
	}
	{
		const { adapter, calls } = mockAdapter();
		const res = await operations.executeItem(adapter, 'get', {
			entityKey: 'projects',
			fields: { value: { code: 'P-1' } },
			input: {},
		});
		ok('G-* get by code', () => {
			assert.ok(calls.some((c) => c[0] === 'get' && c[2].code === 'P-1'));
			assert.ok(res);
		});
	}
	{
		const { adapter, calls } = mockAdapter();
		const res = await operations.executeItem(adapter, 'search', {
			entityKey: 'projects',
			searchFilters: {
				conditions: [{ field: 'status', operator: 'eq', value: 'Active' }],
			},
			page: 1,
			limit: 10,
			sort: 'id/desc',
			fields: {},
			input: {},
		});
		ok('F-* find/search', () => {
			assert.ok(Array.isArray(res));
			assert.strictEqual(res[0].name, 'Found');
			const searchCall = calls.find((c) => c[0] === 'search');
			assert.ok(searchCall);
			assert.strictEqual(searchCall[3].limit, 10);
			assert.strictEqual(searchCall[3].sort, 'id/desc');
		});
	}
	{
		const { adapter, calls } = mockAdapter();
		const res = await operations.executeItem(adapter, 'upsert', {
			entityKey: 'projects',
			fields: { value: { externalKey: 'ext-1', name: 'Upserted' } },
			input: {},
		});
		ok('UP-* upsert', () => {
			assert.strictEqual(res.name, 'Upserted');
			assert.ok(calls.some((c) => c[0] === 'upsert'));
		});
	}
	{
		const { adapter, calls } = mockAdapter();
		const res = await operations.executeItem(adapter, 'clone', {
			entityKey: 'projects',
			id: 11,
			fields: { value: { name: 'Clone' } },
			input: {},
		});
		ok('CL-* clone', () => {
			assert.strictEqual(res.clonedFrom, 11);
			assert.ok(calls.some((c) => c[0] === 'clone'));
		});
	}
	{
		const { adapter, calls } = mockAdapter();
		const res = await operations.executeItem(adapter, 'delete', {
			entityKey: 'projects',
			id: 12,
			input: {},
		});
		ok('D-* delete', () => {
			assert.strictEqual(res.id, 12);
			assert.ok(calls.some((c) => c[0] === 'delete'));
		});
	}
	{
		const { adapter, calls } = mockAdapter();
		const res = await operations.executeItem(adapter, 'move', {
			entityKey: 'tasks',
			id: 20,
			fields: { value: { project: 30, parent: 31 } },
			input: {},
		});
		ok('M-* move task', () => {
			assert.strictEqual(res.id, 20);
			assert.ok(calls.some((c) => c[0] === 'moveTask' && c[1] === 20));
		});
	}
	{
		const { adapter, calls } = mockAdapter({
			schema: async (entityKey, body) => ({
				entityKey,
				operation: body && body.operation,
				refreshSchema: false,
				inputFields: [
					{ key: 'comment', label: 'Comment', type: 'string' },
					{ key: 'recordId', label: 'Record', type: 'integer' },
					{ key: 'transitionId', label: 'Transition', type: 'string' },
				],
				outputFields: [],
			}),
		});
		const res = await operations.executeItem(adapter, 'transition', {
			entityKey: 'apps:1',
			recordId: 40,
			transitionId: 't1',
			fields: { value: { comment: 'ok' } },
			input: {},
		});
		ok('T-* transition', () => {
			assert.ok(calls.some((c) => c[0] === 'transition'));
			assert.ok(res);
		});
	}

	console.log('\nTriggers + webhooks');
	{
		const { adapter, calls } = mockAdapter();
		const sub = await operations.subscribe(
			adapter,
			'projects',
			'created',
			'https://n8n.example/webhook',
			undefined,
			'',
		);
		ok('TC-* subscribe created', () => {
			assert.strictEqual(sub.id, 'sub-1');
			assert.ok(calls.some((c) => c[0] === 'subscribe' && c[1].event === 'created'));
		});
		await operations.unsubscribe(adapter, 'sub-1');
		ok('unsubscribe', () => {
			assert.ok(calls.some((c) => c[0] === 'unsubscribe'));
		});
	}
	ok('TU/TC webhook body parse object', () => {
		const rows = operations.parseWebhookBody({ id: 1, name: 'Hooked' });
		assert.strictEqual(rows.length, 1);
		assert.strictEqual(rows[0].name, 'Hooked');
	});
	ok('webhook body parse data array', () => {
		const rows = operations.parseWebhookBody({ data: [{ id: 2 }] });
		assert.strictEqual(rows[0].id, 2);
	});
	ok('toN8nItems preserves pairedItem', () => {
		const items = operations.toN8nItems({ id: 9 }, 3);
		assert.strictEqual(items[0].json.id, 9);
		assert.strictEqual(items[0].pairedItem.item, 3);
	});

	console.log('\nHelpers used by Find filters');
	{
		const { adapter } = mockAdapter();
		const fields = await operations.getSearchFilterFields(adapter, 'projects');
		ok('getSearchFilterFields', () => {
			assert.ok(fields.some((f) => f.value === 'status'));
		});
		const ops = await operations.getSearchFilterOperators(adapter, 'projects', 'status');
		ok('getSearchFilterOperators', () => {
			assert.ok(ops.some((o) => o.value === 'eq'));
		});
	}

	console.log('\nAuto-map create (Map Automatically)');
	{
		const { adapter, calls } = mockAdapter();
		const res = await operations.executeItem(adapter, 'create', {
			entityKey: 'projects',
			fields: { mappingMode: 'autoMapInputData', value: null },
			input: { name: 'From Input', ignored: 'x' },
		});
		ok('autoMapInputData create', () => {
			assert.strictEqual(res.name, 'From Input');
			assert.ok(calls.some((c) => c[0] === 'create'));
		});
	}

	console.log('\nAll', passed, 'checks passed');
}

run().catch((err) => {
	console.error('\nFAILED:', err);
	process.exit(1);
});
