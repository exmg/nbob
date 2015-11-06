'use strict';

var path = require('path');
var util = require('util');
var _ = require('lodash');
var sass = require('node-sass');
var Batch = require('../batch');
var Processor = require('../processor');
var projectDir = process.cwd();

var processor = new Processor('http://sass-lang.com/');

// Note: This code assumes each non-partial depends on all partials.
// This is not ideal, but saves us from needing to block and read the input files and from tricky import parsing etc.
processor.getBatches = function(inputPaths) {
	var inputs = [];
	var partialInputs = [];
	inputPaths.forEach(function(inputPath) {
		var input = { path: inputPath, trackRatio: true };
		if (path.basename(inputPath)[0] === '_') {
			partialInputs.push(input);
		} else {
			inputs.push(input);
		}
	});

	return inputs.map(function(input) {
		var outputPath = input.path.replace(/\.scss$/, '.css');
		return new Batch(
			[ input ].concat(partialInputs),
			[ { path: outputPath, trackRatio: true }, outputPath + '.map' ]
		);
	});
};

processor.process = function(inputs, outputs) {
	// Import removal batch, nothing to do here
	if (outputs.length === 0) {
		return;
	}

	var input = inputs[0];
	var inputDir = path.dirname(input.path);
	var partials = inputs.slice(1);
	var output = outputs[0];
	var mapOutput = outputs[1];

	// Note: Sass does not support importing from other directories using relative paths so we don't either
	// Also: I tried to implement that using the prev arg, but it proved to be not neatly implementable
	// (for imports of imports the prev arg value would not be the full path that is necessary)
	function importer(url) {
		// Add _ prefix and .scss extension if necessary
		var matches = url.match(/_?(.+?)(\.scss)?$/);
		var partialPath = inputDir + '/_' + matches[1] + '.scss';
		var partial = _.find(partials, { path: partialPath });
		return partial && {
			file: partial.path,
			contents: partial.data
		};
	}

	try {
		var result = sass.renderSync({
			file: input.path,
			data: input.data,
			sourceMap: true,
			outFile: output.path,
			sourceMapContents: true,
			importer: importer
		});

		// Strip source map file reference comment from this as we do not want to deploy that later
		// (since we will not deploy the source map file and that will lead to 404's when debugging)
		// (instead we add X-SourceMap header from our server)
		var css = String(result.css).replace(/\/\*# sourceMappingURL=.*? \*\//, '');
		output.resolve(css);
		mapOutput.resolve(result.map);
	} catch (error) {
		this.log.error('%s %j', error, Object.keys(error));
		var errorPath = path.relative(projectDir, error.file);
		return output.reject(new Error(
			util.format('%s [%s:%d:%d]', error.message, errorPath, error.line, error.column)
		));
	}
};

module.exports = processor;
