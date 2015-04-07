'use strict';

var _ = require('lodash');
var Processor = require('./processor');

module.exports = function(name, config, log) {
	var processor = require('./processor/' + name);

	if (processor instanceof Function) {
		return processor;
	}

	// TODO: Pass config and log as arguments to getBatches and process
	// For now return a Processor clone to facilitate differing configs per Command
	var clone = _.extend(new Processor(), processor);
	clone.init(name, config, log);
	return clone;
};
