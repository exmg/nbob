'use strict';

// For more info on JSCS, see: https://www.npmjs.org/package/jscs

var util = require('util');
var Checker = require('jscs');
var _ = require('lodash');
var minimatch = require('minimatch');
var Processor = require('../processor');
var Promise = require('../promise');
var Batch = require('../batch');

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	var rcPattern = this.config.rcFile;
	var configInputs = [];
	var jsInputs = [];

	// TODO: Implement re-usable support for config files
	// TODO: Add support for ignoring files based on config

	inputPaths.forEach(function(inputPath) {
		if (minimatch(inputPath, rcPattern)) {
			configInputs.push({ path: inputPath, type: 'json', isReadOnly: true });
		} else {
			jsInputs.push({ path: inputPath, isReadOnly: true });
		}
	});

	// Check JS files with the configs
	var batches = jsInputs.map(function(jsInput) {
		return new Batch([ jsInput ].concat(configInputs), [], { multiCore: true });
	});

	// Then 'remove' the configs
	if (configInputs.length > 0) {
		batches.push(new Batch(_.pluck(configInputs, 'path')));
	}

	return batches;
};

processor.process = function(inputs) {
	var rcPattern = this.config.rcFile;
	var log = this.log;
	var input = inputs[0];

	var rcInput = _.find(inputs, function(input) {
		return minimatch(input.path, rcPattern);
	});
	var options = rcInput ? rcInput.data : {};

	if (input === rcInput) {
		return; // This is the config remove batch
	}

	var exclude = _.find(options.excludeFiles, function(excludePattern) {
		return minimatch(input.path, excludePattern);
	});
	if (exclude) {
		return;
	}

	var checker = new Checker();
	checker.registerDefaultRules();
	checker.configure(options);

	var result = checker.checkString(input.data);
	var messages = result.getErrorList().map(function(error) {
		return util.format('%s [%s:%d:%d]', error.message, input.path, error.line, error.column);
	});

	if (messages.length === 0) {
		log.ok('%s', input.path);
	} else {
		return Promise.reject(new Error(
			util.format('%s: %d errors\n%s', input.path, messages.length, messages.join('\n'))
		));
	}
};

module.exports = processor;
