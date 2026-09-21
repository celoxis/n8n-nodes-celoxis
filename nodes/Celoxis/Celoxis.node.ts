import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

// Shared helpers (compiled from JS next to these sources)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { bindMethods, execute, mapping } = require('../../index');

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
		properties: mapping.actionProperties,
	};

	methods = bindMethods();

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return execute(this);
	}
}
