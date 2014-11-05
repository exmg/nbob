'use strict';

module.exports = function(name, config, log) {
	var processor = require('./processor/' + name);

	if (processor.init) {
		processor.init(name, config, log);
	}

	return processor;
};
