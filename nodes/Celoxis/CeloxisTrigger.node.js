'use strict';

const { bindMethods, webhookMethods, webhook, mapping } = require('../../index');

class CeloxisTrigger {
  constructor() {
    this.description = {
      displayName: 'Celoxis Trigger',
      name: 'celoxisTrigger',
      icon: 'file:celoxis.svg',
      group: ['trigger'],
      version: 1,
      subtitle: '={{$parameter["event"]}}',
      description: 'Starts the workflow when a Celoxis record is created or updated',
      defaults: { name: 'Celoxis Trigger' },
      inputs: [],
      outputs: ['main'],
      credentials: [{ name: 'celoxisApi', required: true }],
      webhooks: mapping.webhookConfig,
      properties: mapping.triggerProperties,
    };
    // loadOptions (Type dropdown) — same as action node
    this.methods = bindMethods();
    this.webhookMethods = webhookMethods();
  }

  async webhook() {
    return webhook(this);
  }
}

module.exports = { CeloxisTrigger };
