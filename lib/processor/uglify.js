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
	return inputPaths.map(function(inputPath) {
		var minPath = inputPath.replace(/\.js$/, '.min.js');
		var mapPath = inputPath.replace(/\.js$/, '.map');
		return new Batch([ inputPath ], [ minPath, mapPath ]);
	});
};

processor.process = function(inputs, outputs) {
	var log = this.log;
	var input = inputs[0];
	var minOutput = outputs[0];
	var mapOutput = outputs[1];
	var code = input.data;
	var inputPath = path.basename(input.path);
	var minPath = path.basename(minOutput.path);
	var mapPath = path.basename(mapOutput.path);

	// TODO: Improve source map support by pointing back to original (pre-concat) source files (e.g: ../src/foo.js)
	// E.g: By creating and passing through source maps in earlier processors (es6, concat, amd)
	// When including libs build from other projects it would be nice to pass through their maps and sources as well
	var toplevel = UglifyJS.parse(code, { filename: inputPath });
	toplevel.figure_out_scope();
	var compressor = new UglifyJS.Compressor();
	var compressed = toplevel.transform(compressor);
	compressed.figure_out_scope();
	compressed.compute_char_frequency();
	compressed.mangle_names();
	var sourceMap = new UglifyJS.SourceMap({ file: minPath });
	sourceMap.get().setSourceContent(inputPath, code);
	var stream = new UglifyJS.OutputStream({ source_map: sourceMap });
	compressed.print(stream);

	minOutput.resolve(stream.toString() + '\n//# sourceMappingURL=' + mapPath);
	log.ok('%s', minOutput.path);
	mapOutput.resolve(sourceMap.toString());
	log.ok('%s', mapOutput.path);
};

module.exports = processor;
