'use strict';

var Batch = require('../batch');
var Processor = require('../processor');

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	var log = this.log;
	var filePath = this.config.file;

	if (inputPaths.length) {
		log.debug('%s already exists', filePath);
		return [];
	}

	return [ new Batch([], [ { path: filePath, write: true } ], { doNotCache: true }) ];
};

processor.process = function(inputs, outputs) {
	var log = this.log;
	var output = outputs[0];

	log.info('Creating %s file for Post CSS Autoprefixer etc.', output.path);
	log.info('Example: iOS >= 7, Android >= 4');
	log.info('More info about query syntax: https://github.com/ai/browserslist#queries');
	return log.question('Browsers', '> 1%, last 2 versions').then(function(query) {
		// Convert comma separated query to line separated for config file
		output.resolve(query.split(/,\s*/).join('\n') + '\n');
	});
};

module.exports = processor;
