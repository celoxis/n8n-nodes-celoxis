'use strict';

const { credentials } = require('../index');

class CeloxisApi {
  constructor() {
    this.name = credentials.name;
    this.displayName = credentials.displayName;
    this.documentationUrl = credentials.documentationUrl;
    this.icon = credentials.icon;
    this.properties = credentials.properties;
    this.authenticate = credentials.authenticate;
    this.test = credentials.test;
  }
}

module.exports = { CeloxisApi };
