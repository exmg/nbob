'use strict';

var LOCALE_REGEX = /^l10n\/(.+)\.json$/;

var Processor = require('../processor');
var Batch = require('../batch');

var processor = new Processor();

// Single locale example:
// index-l10n.html => index.html
//
// Multi locale example (en-us and nl-nl with en-us as default):
// index-l10n.html => index.html (en-us) and index-nl-nl.html
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

	// Abort if nothing to localize or localize to
	if (locales.length === 0 || otherPaths.length === 0) {
		return [];
	}

	defName = defName || locales[0].name;

	// First perform batches that produce localized files
	locales.forEach(function(locale) {
		var localeInOutput = { path: locale.path, type: 'json' };
		otherPaths.forEach(function(otherPath) {
			batches.push(new Batch([
				localeInOutput,
				{ path: otherPath, isReadOnly: true }
			], [
				localeInOutput,
				otherPath.replace(/-l10n/, locale.name === defName ? '' : '-' + locale.name)
			]));
		});
	});

	// Finally a batch that removes the original localization template files
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
	var localeOutput = outputs[0];
	var textOutput = outputs[1];

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
	textOutput.resolve(localized);
};

module.exports = processor;
