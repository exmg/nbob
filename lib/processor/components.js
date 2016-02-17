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
//
// OR: "make:bower":
//   for each dependency defined in nbob config
//     does bower install in build dir (or something?) if necessary
//   for each bower component in build dir
//     determine the main files of that component through it's bower.json file
//     optionally include and/or exclude files based on nbob config
//       e.g: webcomponents-lite.min.js instead of webcomponents.js
//     add those to the nbob files (in default /bower_components/ or shorter /bower/ ?)
//
// This should then consume those files as inputs (e.g: through FSResolver)
// This should also facilitate copying webcomponents-lite.min.js?

var _ = require('lodash');
var UglifyJS = require('uglify-js');
var Vulcanize = require('vulcanize');
var fs2 = require('../fs2');
var Batch = require('../batch');
var Processor = require('../processor');

var processor = new Processor();

function FSResolver(config) {
	this.config = config;
}

FSResolver.prototype.accept = function(uri, deferred) {
	var config = this.config;

	// TODO: return false if uri is not a local input path

	fs2.readFile(uri).then(function(buffer) {
		var text = buffer.toString();

		// Minify JS and CSS that is already inlined (e.g. in /bower_components/*/*.html)
		// TODO: Move this out into a separate command and processor? (e.g: make:inline after make:components)
		if (config.minimize) {
			var uglifyOptions = _.extend({
				fromString: true
			}, config.uglify);

			// TODO: Use dom5.parse (like polyclean) instead of regex string replaces below
			// This could go very wrong, e.g: when you have JS that includes strings like <script> or <style>
			text = text.replace(/(<script\>)([\s\S]*?)(<\/script\>)/gm, function(match, open, js, close) {
				js = UglifyJS.minify(js, uglifyOptions).code;
				return open + js + close;
			});

			text = text.replace(/(<style.*?\>)([\s\S]*?)(<\/style\>)/gm, function(match, open, css, close) {
				css = css.
					// Reduce 2 or more spaces to one and remove leading and trailing spaces (copied from polyclean)
					replace(/[\r\n]/g, '').
					replace(/ {2,}/g, ' ').
					replace(/(^|[;,\:\{\}]) /g, '$1').
					replace(/ ($|[;,\{\}])/g, '$1').
					// Remove comments (TODO: Ensure this is safe)
					replace(/\/\*.*?\*\//g, '');
				return open + css + close;
			});
		}

		deferred.resolve(text);
	}, function() {
		deferred.reject(new Error('Error reading file: ' + uri));
	}).catch(function(error) {
		deferred.reject(error);
	});

	return true;
};

processor.getBatches = function(inputPaths) {
	return inputPaths.map(function(inputPath) {
		return new Batch([ inputPath ], [ inputPath ]);
	});
};

processor.process = function(inputs, outputs) {
	var config = this.config;
	var input = inputs[0];
	var output = outputs[0];

	var vulcanizeOptions = _.extend({
		inputUrl: input.path,
		fsResolver: new FSResolver(config)
	}, config.vulcanize);

	var vulcanize = new Vulcanize(vulcanizeOptions);

	vulcanize.process(output.path, function(error, html) {
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
