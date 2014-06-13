'use strict';

var path = require('path');
var minimatch = require('minimatch');
var Processor = require('../processor');
var Batch = require('../batch');

var processor = new Processor();

// Single locale example:
// index-l10n.html => index.html
//
// Multi locale example (en-us and nl-nl with en-us as default):
// index-l10n.html => index.html (en-us) and index-nl-nl.html
processor.getBatches = function(inputPaths) {
	var localesPattern = this.config.locales;
	var locales = [];
	var otherPaths = [];
	inputPaths.forEach(function(inputPath) {
		if (minimatch(inputPath, localesPattern)) {
			locales.push({ name: path.basename(inputPath, '.json'), path: inputPath });
		} else {
			otherPaths.push(inputPath);
		}
	});

	// Abort if nothing to localize or localize to
	if (locales.length === 0 || otherPaths.length === 0) {
		return [];
	}

	var defName = this.config.default || locales[0].name;
	var batches = [];

	// Localize template files with locales one by one
	locales.forEach(function(locale) {
		otherPaths.forEach(function(otherPath) {
			batches.push(new Batch([
				{ path: locale.path, type: 'json', isReadOnly: true },
				{ path: otherPath, isReadOnly: true }
			], [
				otherPath.replace(/-l10n/, locale.name === defName ? '' : '-' + locale.name)
			]));
		});
	});

	// Then remove template files
	batches.push(new Batch(otherPaths, []));

	return batches;
};

processor.process = function(inputs, outputs) {
	// Template removal batch, nothing to do here
	if (outputs.length === 0) {
		return;
	}

	var locale = inputs[0].data;
	var text = inputs[1].data;
	var output = outputs[0];

	// TODO: Detect and warn about syntax errors
	var localized = text.split('\n').map(function(line) {
		return line.replace(/_\('(.*?[^\\])'\)/g, function(ref, id) {
			id = id.replace(/\\'/g, '\''); // unescape escaped quotes
			var record = locale[id];
			return record ? record.localization : id;
		});
	}).join('\n');
	output.resolve(localized);
};

module.exports = processor;
