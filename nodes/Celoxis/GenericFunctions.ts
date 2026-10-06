import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
} from 'n8n-workflow';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createCeloxisAdapter } = require('./helpers/celoxisAdapter');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const operations = require('./operations');

type CeloxisContext =
	| IExecuteFunctions
	| ILoadOptionsFunctions
	| IHookFunctions
	| IWebhookFunctions;

/**
 * Build the Celoxis API client from n8n credentials + httpRequest helper.
 */
export async function getAdapter(this: CeloxisContext) {
	const credentials = await this.getCredentials('celoxisApi');
	const serverUrl = (credentials.serverUrl || credentials.server_url) as string;
	const accessToken = (credentials.accessToken || credentials.access_token) as string;

	return createCeloxisAdapter({
		serverUrl,
		accessToken,
		extraHeaders: { 'X-N8N': true },
		request: async (opts: {
			url: string;
			method: string;
			headers?: IDataObject;
			body?: IDataObject | IDataObject[];
		}) => {
			return this.helpers.httpRequest({
				url: opts.url,
				method: opts.method as 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT',
				headers: opts.headers,
				body: opts.body,
				json: true,
			});
		},
	});
}

export { operations };
