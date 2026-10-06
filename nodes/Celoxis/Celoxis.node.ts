import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	INodePropertyOptions,
	ResourceMapperFields,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { getAdapter, operations } from './GenericFunctions';

const SCHEMA_OPS = new Set(operations.SCHEMA_OPS as string[]);

export class Celoxis implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Celoxis',
		name: 'celoxis',
		icon: { light: 'file:celoxis.svg', dark: 'file:celoxis.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Create, update, find, and delete Celoxis records',
		defaults: {
			name: 'Celoxis',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'celoxisApi',
				required: true,
			},
		],
		properties: operations.actionProperties,
	};

	methods = {
		loadOptions: {
			async getEntityKeys(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const adapter = await getAdapter.call(this);
				const operation = this.getCurrentNodeParameter('operation');
				return operations.getEntityOptions(adapter, { operation });
			},
			async getTransitionOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const adapter = await getAdapter.call(this);
				const entityKey = this.getCurrentNodeParameter('entityKey');
				let recordId = '';
				try {
					recordId = this.getCurrentNodeParameter('recordId') as string;
				} catch {
					recordId = '';
				}
				return operations.getTransitionOptions(adapter, entityKey, recordId);
			},
			async getSearchFilterFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const adapter = await getAdapter.call(this);
				const entityKey = this.getCurrentNodeParameter('entityKey');
				return operations.getSearchFilterFields(adapter, entityKey);
			},
			async getSearchFilterOperators(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const adapter = await getAdapter.call(this);
				const entityKey = this.getCurrentNodeParameter('entityKey');
				let fieldKey = '';
				try {
					fieldKey =
						(this.getCurrentNodeParameter('searchFilters.conditions.field') as string) || '';
				} catch {
					fieldKey = '';
				}
				if (!fieldKey) {
					try {
						const filters = this.getCurrentNodeParameter('searchFilters') as {
							conditions?: Array<{ field?: string }>;
						};
						const rows = filters && Array.isArray(filters.conditions) ? filters.conditions : [];
						const last = rows.length ? rows[rows.length - 1] : null;
						fieldKey = (last && last.field) || '';
					} catch {
						fieldKey = '';
					}
				}
				return operations.getSearchFilterOperators(adapter, entityKey, fieldKey);
			},
		},
		resourceMapping: {
			async getMappingColumns(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				const adapter = await getAdapter.call(this);
				const operation = this.getCurrentNodeParameter('operation') as string;
				const entityKey =
					operation === 'move' ? 'tasks' : this.getCurrentNodeParameter('entityKey');
				const values = this.getCurrentNodeParameters ? this.getCurrentNodeParameters() : {};
				return operations.getMappingColumns(adapter, entityKey, operation, values);
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const adapter = await getAdapter.call(this);
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const operation = this.getNodeParameter('operation', i) as string;
			const entityKey =
				operation === 'move' ? 'tasks' : (this.getNodeParameter('entityKey', i) as string);

			const params: Record<string, unknown> = {
				entityKey,
				id: operations.needsId(operation) ? this.getNodeParameter('id', i) : undefined,
				fields: SCHEMA_OPS.has(operation) ? this.getNodeParameter('fields', i, {}) : undefined,
				input: items[i] && items[i].json ? items[i].json : {},
			};

			if (operation === 'transition') {
				params.recordId = this.getNodeParameter('recordId', i);
				params.transitionId = this.getNodeParameter('transitionId', i);
			}

			if (operation === 'search') {
				try {
					params.searchFilters = this.getNodeParameter('searchFilters', i, {});
				} catch {
					params.searchFilters = {};
				}
				try {
					params.page = this.getNodeParameter('page', i, 1);
				} catch {
					params.page = undefined;
				}
				try {
					const limit = this.getNodeParameter('limit', i, 0) as number;
					params.limit = limit > 0 ? limit : undefined;
				} catch {
					params.limit = undefined;
				}
				try {
					params.sort = this.getNodeParameter('sort', i, '');
				} catch {
					params.sort = undefined;
				}
			}

			const result = await operations.executeItem(adapter, operation, params);
			operations.toN8nItems(result, i).forEach((item: INodeExecutionData) => returnData.push(item));
		}

		return [returnData];
	}
}
