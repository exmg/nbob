/*jshint camelcase:false*/

'use strict';

var path = require('path');
var Processor = require('../processor');
var Batch = require('../batch');
var UglifyJS = require('uglify-js');

var processor = new Processor();

processor.init = function(config, log) {
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
		var batchInputs = inputPaths.indexOf(inputMapPath) !== -1 ? [ inputPath, inputMapPath ] : [ inputPath ];
		var outputPath = inputPath.replace(/\.js$/, '.min.js');
		return new Batch(batchInputs, [ outputPath, outputPath + '.map' ]);
	});
};

processor.process = function(inputs, outputs) {
	var input = inputs[0];
	var mapInput = inputs[1];
	var minOutput = outputs[0];
	var mapOutput = outputs[1];
	var code = input.data;
	var inputPath = input.path;
	var minPath = minOutput.path;
	var mapPath = mapOutput.path;

	var toplevel = UglifyJS.parse(code, { filename: inputPath });
	toplevel.figure_out_scope();
	var compressor = new UglifyJS.Compressor();
	var compressed = toplevel.transform(compressor);
	compressed.figure_out_scope();
	compressed.compute_char_frequency();
	compressed.mangle_names();
	var sourceMap = new UglifyJS.SourceMap(mapInput ? { orig: mapInput, file: minPath } : { file: minPath });
	sourceMap.get().setSourceContent(inputPath, code);
	var stream = new UglifyJS.OutputStream({ source_map: sourceMap });
	compressed.print(stream);

	minOutput.resolve(stream.toString() + '\n//# sourceMappingURL=' + path.basename(mapPath));
	mapOutput.resolve(sourceMap.toString());
};

module.exports = processor;