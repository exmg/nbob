'use strict';

var _ = require('lodash');
var UglifyJS = require('uglify-js');
var Vulcanize = require('vulcanize');
var minimatches = require('../minimatches');
var Batch = require('../batch');
var Processor = require('../processor');

var processor = new Processor();

function FSResolver(config, inputs) {
	this.config = config;
	this.inputs = inputs;
}

FSResolver.prototype.accept = function(uri, deferred) {
	var config = this.config;

	// TODO: return false if uri is not a local input path

	var input = _.find(this.inputs, { path: uri });
	if (input) {
		var text = input.data;
		try {
			// Minify JS and CSS that is already inlined (e.g. in 3rd party bower components)
			// TODO: Move this out into a separate command and processor? (e.g: make:inline before make:components)
			// TODO: Also make it CSP by extracting JS into separate file with/like Polymer Crisper tool
			if (config.minimizeInline) {
				var uglifyOptions = _.extend({
					fromString: true
				}, config.uglify);

				// TODO: Use dom5.parse (like polyclean) instead of regex string replaces below
				// This could go very wrong, e.g: when you have JS that includes strings like <script> or <style>
				// Or just make it disable-able by glob (e.g: minimatches(input.path, config.minimizeFiles))
				text = text.replace(/(<script\>)([\s\S]*?)(<\/script\>)/gm, function(match, open, js, close) {
					js = UglifyJS.minify(js, uglifyOptions).code;
					return open + js + close;
				});

				text = text.replace(/(<style.*?\>)([\s\S]*?)(<\/style\>)/gm, function(match, open, css, close) {
					css = css.
						// Reduce 2 or more spaces to one and remove leading and trailing spaces (source: polyclean)
						replace(/[\r\n]/g, '').
						replace(/ {2,}/g, ' ').
						replace(/(^|[;,\:\{\}]) /g, '$1').
						replace(/ ($|[;,\{\}])/g, '$1').
						// Remove comments (TODO: Ensure this is safe)
						replace(/\/\*.*?\*\//g, '');
					return open + css + close;
				});

				text = text.replace(/<!--.*?-->/gm, '');
			}

			deferred.resolve(text);
		} catch(error) {
			deferred.reject(error);
		}
	} else {
		deferred.reject(new Error('File not found in inputs: ' + uri));
	}

	return true;
};

processor.getBatches = function(inputPaths) {
	var config = this.config;

	var bowerPath = inputPaths[0] === config.bower && inputPaths.shift();
	if (!inputPaths.length) {
		return [];
	}

	var inputs = inputPaths.map(function(inputPath) {
		// When vulcanizing, HTML component files are inlined into output (thus not read only)
		return { path: inputPath, isReadOnly: !config.vulcanize || !/\.html$/.test(inputPath) };
	});

	if (bowerPath) {
		inputs.unshift({ path: bowerPath, isReadOnly: true, type: 'json' });
	}

	return [ new Batch(inputs, [ { path: config.output, trackRatio: true } ]) ];
};

processor.process = function(inputs, outputs) {
	var config = this.config;
	var output = outputs[0];

	// TODO: Simplify all of this by just requiring you to specify the main html file(s) containing imports
	// (e.g: index.html that imports foo-app.html or hand made components.html) and derive dependencies etc. from that.
	//
	// Bonus points if this would be able to read bower_components files directly from FS (besides from nBob inputs).
	// That way you will have a lot less configuration to do.
	// Also change bower copy default config not to copy anything unless specified, thus saving unnecessary IO's
	// For nbob caching just using the bower.json as input should suffice.
	//
	// This will however make Vulcanization obligatory as no files will be copied to dist for dynamic loading... :(
	// Could also change that so we use a symbolic link or something to link from dist/bower_components

	var importPaths = minimatches(_.pluck(inputs, 'path'), config.imports);

	// Filter out bower components that are not explicitly depended on to make output more deterministic and clean
	if (inputs[0].path === config.bower) {
		var bowerInput = inputs.shift();
		var bowerDeps = Object.keys(bowerInput.data.dependencies);

		importPaths = importPaths.filter(function(importPath) {
			if (importPath.indexOf('bower_components/') !== 0) {
				return true;
			}
			var bowerName = importPath.match(/bower_components\/([^\/]+)\//)[1];
			return bowerDeps.indexOf(bowerName) >= 0;
		});
	}

	// Generate initial un-vulcanized output data (html that imports all of the components)
	var outputData = importPaths.map(function(importPath) {
		return '<link rel="import" href="' + importPath + '">';
	}).join('\n');

	if (!config.vulcanize) {
		output.resolve(outputData);
		return;
	}

	var files = inputs.concat({
		path: output.path,
		data: outputData
	});

	var vulcanize = new Vulcanize(_.extend({}, config.vulcanize, {
		inputUrl: output.path,
		fsResolver: new FSResolver(config, files)
	}));

	vulcanize.process(output.path, function(error, html) {
		if (error) {
			output.reject(error);
		} else {
			output.resolve(html);
		}
	});
};

module.exports = processor;
