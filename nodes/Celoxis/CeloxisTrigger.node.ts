import type {
	IHookFunctions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { getAdapter, operations } from './GenericFunctions';

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
		webhooks: operations.webhookConfig,
		properties: operations.triggerProperties,
	};

	methods = {
		loadOptions: {
			async getTriggerEntityKeys(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const adapter = await getAdapter.call(this);
				const event = this.getCurrentNodeParameter('event');
				return operations.getEntityOptions(adapter, { event });
			},
			async getTriggerTransitions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const adapter = await getAdapter.call(this);
				const entityKey = this.getCurrentNodeParameter('entityKey');
				return operations.getTriggerTransitionOptions(adapter, entityKey);
			},
		},
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				return !!(data && data.subscriptionId);
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const adapter = await getAdapter.call(this);
				const entityKey = this.getNodeParameter('entityKey') as string;
				const event = this.getNodeParameter('event') as string;
				let transitionId = '';
				try {
					transitionId = this.getNodeParameter('transitionId') as string;
				} catch {
					transitionId = '';
				}
				const targetUrl = this.getNodeWebhookUrl('default');
				const res = await operations.subscribe(
					adapter,
					entityKey,
					event,
					targetUrl,
					undefined,
					transitionId,
				);
				const data = this.getWorkflowStaticData('node');
				data.subscriptionId = res && (res.id || (res.data && res.data.id));
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				const id = data && data.subscriptionId;
				if (!id) {
					return true;
				}
				const adapter = await getAdapter.call(this);
				await operations.unsubscribe(adapter, id);
				delete data.subscriptionId;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData ? this.getBodyData() : this.getRequestObject().body;
		const rows = operations.parseWebhookBody(body);
		return {
			workflowData: [operations.toN8nItems(rows)],
		};
	}
}
