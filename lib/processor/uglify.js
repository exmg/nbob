'use strict';

var path = require('path');
var Processor = require('../processor');
var Batch = require('../batch');
var UglifyJS = require('uglify-js');

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	return inputPaths.map(function(inputPath) {
		var minPath = inputPath.replace(/\.js$/, '.min.js');
		var mapPath = inputPath.replace(/\.js$/, '.map');
		return new Batch([ { path: inputPath, isReadOnly: true } ], [ minPath, mapPath ]);
	});
};

processor.process = function(inputs, outputs) {
	/*jshint camelcase:false*/
	var log = this.log;
	var input = inputs[0];
	var minifiedOutput = outputs[0];
	var sourceMapOutput = outputs[1];
	var text = input.data;

	// TODO: Improve source map support by pointing back to original (pre-concat) files
	// More info: https://github.com/mishoo/UglifyJS2
	var toplevel = UglifyJS.parse(text);
	toplevel.figure_out_scope();
	var compressor = new UglifyJS.Compressor();
	var compressed = toplevel.transform(compressor);
	compressed.figure_out_scope();
	compressed.compute_char_frequency();
	compressed.mangle_names();
	var sourceMap = new UglifyJS.SourceMap({ file: path.basename(input.path) });
	var stream = new UglifyJS.OutputStream({ source_map: sourceMap });
	compressed.print(stream);

	// TODO: Fix source map so it works in Chrome etc.
	minifiedOutput.resolve(stream.toString() + '\n//# sourceMappingURL=' + sourceMapOutput.path);
	log.ok('%s', minifiedOutput.path);
	sourceMapOutput.resolve(sourceMap.toString());
	log.ok('%s', sourceMapOutput.path);
};

module.exports = processor;
