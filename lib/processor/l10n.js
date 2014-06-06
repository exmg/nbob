'use strict';

var LOCALE_REGEX = /^l10n\/(.+)\.json$/;

var Processor = require('../processor');
var Batch = require('../batch');

var processor = new Processor();

// Single locale example:
// index-l10n.html => index.html
//
// Multi locale example (en-us and nl-nl with en-us as default):
// index-l10n.html => index.html (en-us), index-en-us.html and index-nl-nl.html
processor.getBatches = function(inputPaths) {
	var defName = this.config.default;
	var batches = [];

	var locales = [];
	var otherPaths = [];
	inputPaths.forEach(function(inputPath) {
		var matches = inputPath.match(LOCALE_REGEX);
		if (matches) {
			locales.push({ name: matches[1], path: inputPath });
		} else {
			otherPaths.push(inputPath);
		}
	});

	if (locales.length > 0) {
		defName = defName || locales[0].name;
	}

	locales.forEach(function(locale) {
		var localeInOutput = { path: locale.path, type: 'json' };
		otherPaths.forEach(function(otherPath) {
			var outputs = [ localeInOutput ];
			if (locales.length > 1) {
				outputs.push(otherPath.replace(/-l10n/, locale.name));
			}
			if (locale.name === defName) {
				outputs.push(otherPath.replace(/-l10n/, ''));
			}
			batches.push(new Batch([ localeInOutput, otherPath ], outputs));
		});
	});

	batches.forEach(function(batch) {
		console.log('Batch %s => %s',
			require('lodash').pluck(batch.inputs, 'path').join(', '),
			require('lodash').pluck(batch.inputs, 'path').join(', ')
		);
	});

	return batches;
};

processor.process = function(inputs, outputs) {
	var locale = inputs[0].data;
	var text = inputs[1].data;
	var localeOutput = outputs[0];
	var textOutputs = outputs.slice(1);

	// TODO: Update locale with added and removed keys etc.
	localeOutput.resolve(locale);

	// TODO: Detect and warn about syntax errors
	var localized = text.split('\n').map(function(line) {
		return line.replace(/_\('(.*?[^\\])'\)/g, function(ref, id) {
			id = id.replace(/\\'/g, '\''); // unescape escaped quotes
			var record = locale[id];
			return record ? record.localization : id;
		});
	}).join('\n');
	textOutputs.forEach(function(textOutput) {
		textOutput.resolve(localized);
	});
};

module.exports = processor;
