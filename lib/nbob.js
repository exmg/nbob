'use strict';

// TODO: Use update-notifier to encourage use of latest version of nbob

// Monkey patch fs to work around "EMFILE, too many open files"
require('graceful-fs');

var _ = require('lodash');
var Promise = require('./promise');
var pkg = require('../package.json');
var commands = require('./commands');
var args = require('./args');
var config = require('./config');
var Logger = require('./logger');
var File = require('./file');
var files = require('./files');
var bar = require('./bar');
var log = Logger.create('nbob');
var nbobStart = Date.now();

function timeSince(start) {
	var ms = Date.now() - start;
	return ms < 100 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's';
}

var argCommands = args.commands;
if (argCommands.length === 0) {
	// TODO: Show brief help here, add option --help for showing full help
	log.help('No command(s) specified');
}

log.info('nBob v%s: %s v%s', pkg.version, config.project.name, config.project.version);
log.debug('Commands:', argCommands.map(function(command) {
	return commands.getName(command);
}).join(', '));
log.debug('Options:', args.options);
log.spam('Config:', config);

process.chdir(args.options.dir);

files.init();
log.spam('Files:\n  %s', files.getPaths().join('\n  '));

// Keep track of all processor promises to know when all async processing is resolved
var processorPromises = [];

// Processors selected through commands are turned into files task functions
// These should return a Promise indicating they are done manipulating files
var filesTasks = _.filter(commands.select(argCommands), 'processor').map(function(command) {
	var processorName = command.processor;
	var commandName = commands.getName(command);
	var shortName = commands.getName(command, true);
	var pConfig = _.extend(config[commandName], { project: config.project });
	var pLog = Logger.create(shortName);

	var processor = require('./processor/' + processorName + '.js');

	// Legacy processor
	if (processor instanceof Function) {
		return function() {
			pLog.debug('Starting');
			var processorStart = Date.now();
			var inputFiles = files.getList();
			bar.add(shortName);
			var output = processor(pConfig, pLog, inputFiles);
			return Promise.resolve(output).then(function(outputFiles) {
				if (outputFiles) {
					_.difference(outputFiles, inputFiles).forEach(function(file) {
						files.add(file);
					});
					_.difference(inputFiles, outputFiles).forEach(function(file) {
						files.remove(file);
					});
				} else {
					// Re-initialize from file system to figure out what the situation is now
					files.init();
				}
				pLog.info('Finished after: %s', timeSince(processorStart));
				bar.finish(shortName);
			});
		};
	}

	return function() {
		var processorStart;
		processor.init(pConfig, pLog);

		var batches = processor.getBatches(files.getPaths());
		var nrBatches = batches.length;
		pLog.debug('Starting %d batches', nrBatches);

		var batchPromises = batches.map(function(batch, batchIndex) {
			// Rename files
			batch.outputs.forEach(function(output) {
				if (output.fromPath && output.path !== output.fromPath) {
					files.get(output.fromPath).path = output.path;
				}
			});

			// Remove files
			var inputPaths = _.pluck(batch.inputs, 'path');
			var outputPaths = _.pluck(batch.outputs, 'path');
			_.difference(inputPaths, outputPaths).forEach(function(removedPath) {
				files.remove(removedPath);
			});

			// Prepare input promises with data
			var inputPromises = batch.inputs.map(function(input) {
				var file = files.get(input.path);
				return file.get(input.type).then(function(data) {
					input.data = data;
					return input;
				});
			});

			// Only outputs without fromPath require data processing
			var dataOutputs = batch.outputs.filter(function(output) {
				return !output.fromPath;
			});

			// Prepare output data promises
			var dataPromises = dataOutputs.map(function(output) {
				var file = new File(output.path);
				files.add(file);
				return file.set(output.type, new Promise(function(resolve, reject) {
					output.resolve = resolve;
					output.reject = reject;
				}));
			});

			var finishPromise = Promise.all(dataPromises);

			// Wait for input promises and then have process resolve output promises
			var batchStart;
			var processPromise = Promise.all(inputPromises).then(function(inputs) {
				// Processor starts when first batch starts
				if (!processorStart) {
					processorStart = Date.now();
					bar.add(shortName, nrBatches);
				}

				pLog.spam('Starting batch #%d', batchIndex);
				batchStart = Date.now();

				// TODO: Distribute process calls over this and other threads to improve multi-core performance
				processor.process(inputs, dataOutputs);
			});

			return Promise.all([ processPromise, finishPromise ]).then(function() {
				pLog.spam('Finished batch #%d after: %s', batchIndex, timeSince(batchStart));
				bar.finish(shortName);
			});
		});

		var processorPromise = Promise.all(batchPromises);
		processorPromise.then(function() {
			pLog.info('Finished %d batches after: %s', nrBatches, timeSince(processorStart));
		});
		processorPromises.push(processorPromise);

		// All files changes have been made already (add, remove, path change, setBuffer promise)
		// Resolve task immediately so following tasks can be started
		return Promise.resolve();
	};
});

// Call files tasks sequentially
filesTasks.reduce(function(prevPromise, task) {
	return prevPromise.then(task);
}, Promise.resolve()).then(function() {
	// Wait for all (including async) processing to finish
	return Promise.all(processorPromises).then(function() {
		log.info('nBob finished after: %s', timeSince(nbobStart));
	});
}).catch(function(error) {
	log.fatal(error);
});
