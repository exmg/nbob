'use strict';

var map = {};

module.exports = function(name, config, log) {
	if (map[name]) {
		return map[name];
	}

	var processor = require('./processor/' + name);

	if (processor.init) {
		processor.init(name, config, log);
	}

	map[name] = processor;

	return processor;
};
