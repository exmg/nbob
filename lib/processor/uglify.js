/*jshint camelcase:false*/
/*jscs:disable requireCamelCaseOrUpperCaseIdentifiers*/

'use strict';

var util = require('util');
var _ = require('lodash');
var Processor = require('../processor');
var Batch = require('../batch');
var UglifyJS = require('uglify-js');

var processor = new Processor('https://github.com/mishoo/UglifyJS2');

processor.init = function(name, config, log) {
	Processor.prototype.init.apply(this, arguments);

	// Override this to prevent console output messing with progress bar etc.
	UglifyJS.AST_Node.warn_function = function(txt) {
		log.warn(txt);
	};
};

processor.getBatches = function(inputPaths) {
	return inputPaths.filter(function(inputPath) {
		return /\.js$/.test(inputPath);
	}).map(function(inputPath) {
		var inputMapPath = inputPath + '.map';
		var batchInputs = [ { path: inputPath, trackRatio: true } ];
		if (inputPaths.indexOf(inputMapPath) !== -1) {
			batchInputs.push(inputMapPath);
		}
		var outputPath = inputPath.replace(/\.js$/, '.min.js');
		var batchOutputs = [ { path: outputPath, trackRatio: true }, outputPath + '.map' ];
		return new Batch(batchInputs, batchOutputs, { multiCore: true });
	});
};

processor.process = function(inputs, outputs) {
	var config = this.config;
	var input = inputs[0];
	var mapInput = inputs[1];
	var minOutput = outputs[0];
	var mapOutput = outputs[1];
	var code = input.data;
	var inputPath = input.path;
	var minPath = minOutput.path;

	try {
		UglifyJS.base54.reset();
		var toplevel = UglifyJS.parse(code, { filename: inputPath });
		toplevel.figure_out_scope();
		var compressor = new UglifyJS.Compressor(config.compressor);
		var compressed = toplevel.transform(compressor);
		compressed.figure_out_scope();
		compressed.compute_char_frequency();
		if (config.mangle) {
			compressed.mangle_names();
		}
		var sourceMap = new UglifyJS.SourceMap(mapInput ? { orig: mapInput.data, file: minPath } : { file: minPath });
		sourceMap.get().setSourceContent(inputPath, code);
		minOutput.resolve(compressed.print_to_string(_.extend({
			source_map: sourceMap
		}, config.printer)));
		mapOutput.resolve(JSON.stringify(sourceMap.get(), null, '\t'));
	} catch (e) {
		// Add some details to error message
		throw new Error(util.format('%s [%s:%d:%d]', e.message, inputPath, e.line, e.col));
	}
};

module.exports = processor;
