'use strict';

var EXCLUDE_TAGS = [ 'script', 'style' ];

var Batch = require('../batch');
var Processor = require('../processor');

var processor = new Processor();

// Note: This minifier can brake things, if so then just exclude the affected file in your nbob config
// The alternatives (e.g: minimize, html-minifier) do not mix well with HTML templating or are overly complicated
// with too many dependencies etc.

processor.getBatches = function(inputPaths) {
	return inputPaths.map(function(inputPath) {
		var inputs = [ { path: inputPath, trackRatio: true } ];
		return new Batch(inputs, inputs);
	});
};

processor.process = function(inputs, outputs) {
	var input = inputs[0];
	var output = outputs[0];
	var text = input.data;
	var excluded = [];

	// Note: multi-line regex's have to work with [\s\S\] instead of .

	// Temporarily replace excluded tag blocks by placeholders
	EXCLUDE_TAGS.forEach(function(tag) {
		var tagRegEx = new RegExp('<' + tag + '[>\\s][\\s\\S]*?</' + tag + '>', 'gm');
		text = text.replace(tagRegEx, function(match) {
			var index = excluded.push(match) - 1;
			return 'html-minify-exclude-placeholder-' + index;
		});
	});

	// Remove comments
	text = text.replace(/<!--([\s\S]*?)-->/gm, function(match, paren1) {
		// Leave Internet Explorer conditional comments
		return /\[if IE/.test(paren1) ? match : '';
	});

	// Reduce whitespace to a single space and trim
	text = text.replace(/\s+/gm, ' ').trim();

	// Restore excluded tag blocks
	text = text.replace(/html-minify-exclude-placeholder-(\d+)/g, function(match, p1) {
		return excluded[p1];
	});

	output.resolve(text);
};

module.exports = processor;
