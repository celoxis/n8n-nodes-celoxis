import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class CeloxisApi implements ICredentialType {
	name = 'celoxisApi';

	displayName = 'Celoxis API';

	documentationUrl = 'https://www.celoxis.com/';

	icon = 'file:../nodes/Celoxis/celoxis.svg' as const;

	properties: INodeProperties[] = [
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
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
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.accessToken}}',
				'X-N8N': true,
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.serverUrl}}',
			url: '/psa/api/v2/me',
			headers: {
				'X-N8N': true,
			},
		},
	};
}
