'use strict';

var Handlebars = require('handlebars');
var Batch = require('../batch');
var hbsUtil = require('../hbs-util');
var minimatches = require('../minimatches');
var Processor = require('../processor');

var processor = new Processor('http://handlebarsjs.com');

processor.getBatches = function(inputPaths) {
	var config = this.config;

	var templatePaths = [];
	var partialPaths = [];
	inputPaths.forEach(function(inputPath) {
		var paths = minimatches(inputPath, config.partialFiles) ? partialPaths : templatePaths;
		paths.push(inputPath);
	});

	if (templatePaths.length === 0) {
		return [];
	}

	if (config.helpers) {
		partialPaths.push(config.helpers);
	}

	var partialInputs = partialPaths.map(function(partialPath) {
		return { path: partialPath, isReadOnly: true };
	});

	return templatePaths.map(function(templatePath) {
		return new Batch(
			[ templatePath ].concat(partialInputs),
			[ templatePath.replace(/\.hbs$/, '.html') ]
			// { multiCore: true }
		);
	}).concat(new Batch(partialPaths)); // And finally cleanup the partials (and helpers) files
};

processor.process = function(inputs, outputs) {
	var config = this.config;
	var templateInput = inputs[0];
	var partialInputs = inputs.slice(1);
	var helpersInput = config.helpers && partialInputs.pop();
	var output = outputs[0];
	var inputPath; // used to provide some more info about where an error is coming from

	// Do nothing when this is the partials removal batch
	if (!output) {
		return;
	}

	try {
		// Work with isolated Handlebars environment
		var hbs = Handlebars.create();

		partialInputs.forEach(function(partialInput) {
			var path = partialInput.path;
			var name = hbsUtil.getName(path, config.nameRegex);
			inputPath = path;
			var partial = hbs.compile(partialInput.data, config.options);
			hbs.registerPartial(name, partial);
		});

		if (helpersInput) {
			inputPath = helpersInput.path;
			/*jshint evil:true*/
			var helpers = new Function(helpersInput.data).call(hbs);
			/*jshint evil:false*/
			hbs.registerHelper(helpers);
		}

		inputPath = templateInput.path;
		var template = hbs.compile(templateInput.data, config.options);
		var html = template({
			template: templateInput.path // can be usefull as a variable in templates
			// TODO: Add support for adding context data via an adjacent .hbs.json file or something?
		});

		// Workaround for some bizar issue with output coming out empty unless prefixed with something
		// TODO: Properly fix this empty output issue
		output.resolve('\n' + html);
	} catch (error) {
		output.reject(hbsUtil.improveError(error, inputPath));
	}
};

module.exports = processor;
