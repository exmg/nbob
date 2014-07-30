'use strict';

var util = require('util');
var _ = require('lodash');
var minimatch = require('minimatch');
var jshint = require('jshint').JSHINT;
var Processor = require('../processor');
var Promise = require('../promise');
var Batch = require('../batch');

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	var rcPattern = this.config.rcFile;
	var ignorePattern = this.config.ignoreFile;
	var configInputs = [];
	var jsInputs = [];

	inputPaths.forEach(function(inputPath) {
		if (minimatch(inputPath, rcPattern)) {
			configInputs.push({ path: inputPath, type: 'json', isReadOnly: true });
		} else if (minimatch(inputPath, ignorePattern)) {
			configInputs.push({ path: inputPath, isReadOnly: true });
		} else {
			jsInputs.push({ path: inputPath, isReadOnly: true });
		}
	});

	// JSHint JS files with the configs
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
	var ignorePattern = this.config.ignoreFile;
	var log = this.log;
	var input = inputs[0];

	var ignoreInput = _.find(inputs, function(input) {
		return minimatch(input.path, ignorePattern);
	});
	var ignorePatterns = !ignoreInput ? [] : ignoreInput.data.split('\n').map(function(line) {
		return line.trim();
	}).filter(function(line) {
		return !!line;
	});
	var ignore = _.find(ignorePatterns, function(ignorePattern) {
		return minimatch(input.path, ignorePattern);
	});
	if (ignore) {
		return;
	}

	var rcInput = _.find(inputs, function(input) {
		return minimatch(input.path, rcPattern);
	});
	var options = rcInput ? rcInput.data : {};

	if (input === ignoreInput || input === rcInput) {
		return; // This is the config remove batch
	}

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
