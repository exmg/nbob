/*jshint camelcase:false*/
/*jscs:disable requireCamelCaseOrUpperCaseIdentifiers*/

'use strict';

var util = require('util');
var _ = require('lodash');
var UglifyJS = require('uglify-js');
var Batch = require('../batch');
var minimatches = require('../minimatches');
var Processor = require('../processor');

var processor = new Processor('https://github.com/mishoo/UglifyJS2');

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

	// Fail on warnings
	var warn_function = UglifyJS.AST_Node.warn_function;
	UglifyJS.AST_Node.warn_function = function(txt) {
		var matches = txt.match(/^(.*) \[(.*):(\d+),(\d+)\]$/);
		if (!matches) {
			throw new Error(txt);
		} else if (!minimatches(matches[2], config.ignoreFiles)) {
			throw _.extend(new Error(matches[1]), { line: matches[3], col: matches[4] });
		}
	};

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
	} finally {
		// Restore original warning handler
		UglifyJS.AST_Node.warn_function = warn_function;
	}
};

module.exports = processor;
