'use strict';

var Logger = require('./logger');
var map = {};

module.exports = function(name, config, logName) {
	if (map[name]) {
		return map[name];
	}

	var processor = require('./processor/' + name);

	if (processor.init) {
		var log = Logger.create(logName);
		processor.init(config, log);
	}

	map[name] = processor;

	return processor;
};
