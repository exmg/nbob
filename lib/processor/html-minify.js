'use strict';

var Batch = require('../batch');
var Processor = require('../processor');

var processor = new Processor();

// Note: This minifier can brake things, if so then just exclude the affected file in your nbob config
// The alternatives (e.g: minimize, html-minifier) do not mix well with HTML templating or are overly complicated
// with too many dependencies etc.
//
// Tip: By minifying CSS and JS before including in HTML the whitespace reduction should not do any harm
// nBob currently does not yet minify CSS, but if you just rename your .css include file to .less it will be minified

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

	// Remove comments
	text = text.replace(/<!--(.*)-->/g, function(match, paren1) {
		// Leave Internet Explorer conditional comments
		return /\[if IE/.test(paren1) ? match : '';
	});

	// Reduce and trim whitespace
	text = text.replace(/\s+/g, ' ').trim();

	output.resolve(text);
};

module.exports = processor;
