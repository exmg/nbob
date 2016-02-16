'use strict';

// Right now this silently expects you to deal with bower to install any components yourself
// all files in /bower_components/ are excluded by nbob so can not be used by default
// components.html should import whatever you want to use from /bower_components/
// Vulcanize will then inline those files outside of nbob
// Hence: you will have to clean nbob cache whenever you change any of the files referred in /bower_components/
//
// TODO: Figure out how to work with our own components next to these
// E.g: Work with /components/index.html instead, referring to both /bower_components/*/*.html and /components/*/*.html
// That would allow those components to use Sass and Babel etc. in /components/*/*.scss and *.js etc.
// Would require /components/*/* to subsequently be consumed by this processor
//
// TODO: Add integrated support for Bower through "update:dependencies" command
// "update:dependencies" could do bower install of dependencies specified for it in nbob-config.json
//   and replace the project.dependencies value by concatenating all of the */bower.json main files
//   wendy should then add project.dependencies files to the project input files (still exclude the other bower files)
//   this enables automatic inclusion of only the required web component html files from the bower_components sub dirs

var _ = require('lodash');
var UglifyJS = require('uglify-js');
var Vulcanize = require('vulcanize');
var fs2 = require('../fs2');
var minimatches = require('../minimatches');
var Batch = require('../batch');
var Processor = require('../processor');
var nbobConfig = require('../config');

var processor = new Processor();

// This is a simplified version of what uglify processor does
// TODO: Expose this function as a static function in uglify processor and use that instead
// And add the necessary options to disable source map etc. (no support for that yet in HTML unfortunately)
function uglify(inputPath, code) {
	/*jshint camelcase:false*/
	/*jscs:disable requireCamelCaseOrUpperCaseIdentifiers*/

	// We re-use the config of make:js:minify (thus also works nicely in debug environment)
	var config = nbobConfig.object['make:js:minify'];

	// Fail on warnings
	var warn_function = UglifyJS.AST_Node.warn_function;
	UglifyJS.AST_Node.warn_function = function(txt) {
		var matches = txt.match(/^(.*) \[(.*):(\d+),(\d+)\]$/);
		if (!matches) {
			throw new Error(txt);
		} else if (!minimatches(matches[2], config.ignoreFiles)) {
			throw new Error(matches[1] + ' [' + matches[2] + ':' + matches[3] + ':' + matches[4] + ']');
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
		return compressed.print_to_string(config.printer);
	} finally {
		// Restore original warning handler
		UglifyJS.AST_Node.warn_function = warn_function;
	}
}

function FSResolver() {
}

FSResolver.prototype.accept = function(uri, deferred) {
	// TODO: return false if uri is not a local input path
	fs2.readFile(uri).then(function(buffer) {
		var text = buffer.toString();

		// Minify JS and CSS that is already inlined (e.g. in /bower_components/*/*.html)
		// TODO: Move this out into a separate command and processor? (e.g: make:inline after make:components)
		try {
			var minified = text.replace(/<script\>([\s\S]*?)<\/script\>/gm, function(match, code) {
				return '<script>' + uglify(uri, code) + '</script>';
			});
			// TODO: CSS (generally a lot less significant amount though)
			deferred.resolve(minified);
		} catch (error) {
			deferred.reject(error);
		}
	}, function() {
		deferred.reject(new Error('Error reading file: ' + uri));
	});

	return true;
};

processor.getBatches = function(inputPaths) {
	return inputPaths.map(function(inputPath) {
		return new Batch([ inputPath ], [ inputPath ]);
	});
};

processor.process = function(inputs, outputs) {
	var input = inputs[0];
	var output = outputs[0];
	var options = _.extend({
		inputUrl: input.path,
		fsResolver: new FSResolver()
	}, this.config.options);
	var vulcan = new Vulcanize(options);

	vulcan.process(output.path, function(error, html) {
		if (error) {
			if (error.message.lastIndexOf(']') !== error.message.length - 1) {
				error.message += ' [' + input.path + ']';
			}
			output.reject(error);
		} else {
			output.resolve(html);
		}
	});

};

module.exports = processor;
