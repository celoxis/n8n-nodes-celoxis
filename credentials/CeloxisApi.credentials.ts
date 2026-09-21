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
				'Copy and paste your access token generated in Celoxis. (Click on API under your profile icon. You must have administrator privileges)',
		},
		{
			displayName: 'Server URL',
			name: 'serverUrl',
			type: 'string',
			required: true,
			default: 'https://app.celoxis.com',
			description:
				'US SaaS customers - https://app.celoxis.com. EU SaaS customers - https://eu.celoxis.com. On-premise customers - enter the value on your Administration > Site Settings page.',
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
