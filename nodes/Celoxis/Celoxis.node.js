'use strict';

const { bindMethods, execute, mapping } = require('../../index');

class Celoxis {
  constructor() {
    this.description = {
      displayName: 'Celoxis',
      name: 'celoxis',
      icon: 'file:celoxis.svg',
      group: ['transform'],
      version: 1,
      subtitle: '={{$parameter["operation"]}}',
      description: 'Create, update, find, and delete Celoxis records',
      defaults: { name: 'Celoxis' },
      inputs: ['main'],
      outputs: ['main'],
      credentials: [{ name: 'celoxisApi', required: true }],
      properties: mapping.actionProperties,
    };
    this.methods = bindMethods();
  }

  async execute() {
    return execute(this);
  }
}

module.exports = { Celoxis };
