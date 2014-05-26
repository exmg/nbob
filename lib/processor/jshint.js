'use strict';

var fs = require('fs');
var util = require('util');
var jshint = require('jshint').JSHINT;
var Processor = require('../processor');
var Promise = require('../promise');
var Batch = require('../batch');

var processor = new Processor();

function getOptions(config, log) {
	var options = {};
	var path = config.rcFile;
	if (fs.existsSync(path)) {
		try {
			options = JSON.parse(fs.readFileSync(path, { encoding: 'utf8' }));
		} catch (e) {
			log.warn('Error while reading: %s', path, e);
		}
	} else {
		log.debug(path + ' does not exist');
	}
	return options;
}

function getIgnores(config, log) {
	var ignores = [];
	var path = config.ignoreFile;
	if (fs.existsSync(path)) {
		try {
			ignores = fs.readFileSync(path, { encoding: 'utf8' }).split('\n').map(function(line) {
				return line.trim();
			}).filter(function(line) {
				return !!line;
			});
		} catch (e) {
			log.warn('Error while reading: %s', path, e);
		}
	} else {
		log.debug(path + ' does not exist');
	}
	return ignores;
}

processor.init = function(config, log) {
	Processor.prototype.init.apply(this, arguments);

	if (this.options) {
		return; // already initialized once before
	}

	// TODO: Use .jshintrc and .jshintignore as inputs for process() (like locale in l10n processor)
	// Now we are sync reading, blocking following processor inits and missing any changes made to these files

	// Get options from .jshintrc
	this.options = getOptions(config, log);

	// Get ignores from .jshintignore, turn them into patterns and add those to our config.files patterns
	var patterns = getIgnores(config, log).map(function(ignore) {
		return '!' + ignore;
	});
	[].push.apply(this.config.files, patterns);
};

processor.getBatches = function(inputPaths) {
	return inputPaths.map(function(inputPath) {
		return new Batch([ { path: inputPath, isReadOnly: true } ]);
	});
};

processor.process = function(inputs) {
	var input = inputs[0];
	var options = this.options;
	var log = this.log;

	if (jshint(input.data, options)) {
		log.ok('%s', input.path);
	} else {
		var errors = jshint.errors;
		errors.forEach(function(error) {
			if (!error) {
				return;
			}
			log.warn('#%s: %s [%s:%d:%d]', error.code, error.reason, input.path, error.line, error.character);
		});
		return Promise.reject(new Error(util.format('%s: %d errors', input.path, errors.length)));
	}
};

module.exports = processor;
