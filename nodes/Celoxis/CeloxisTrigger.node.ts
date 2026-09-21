import type {
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

// Shared helpers compiled from JS (CommonJS)
import helpers = require('../../index');

const { bindMethods, webhookMethods, webhook, mapping } = helpers as {
	bindMethods: () => INodeType['methods'];
	webhookMethods: () => INodeType['webhookMethods'];
	webhook: (ctx: IHookFunctions | IWebhookFunctions) => Promise<IWebhookResponseData>;
	mapping: {
		webhookConfig: INodeTypeDescription['webhooks'];
		triggerProperties: INodeTypeDescription['properties'];
	};
};

export class CeloxisTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Celoxis Trigger',
		name: 'celoxisTrigger',
		icon: { light: 'file:celoxis.svg', dark: 'file:celoxis.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts the workflow when a Celoxis record is created or updated',
		defaults: {
			name: 'Celoxis Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'celoxisApi',
				required: true,
			},
		],
		webhooks: mapping.webhookConfig,
		properties: mapping.triggerProperties,
	};

	methods = bindMethods();

	webhookMethods = webhookMethods();

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		return webhook(this);
	}
}
