'use strict';

var _ = require('lodash');
var bar = require('./bar');
var commands = require('./commands');
var config = require('./config');
var files = require('./files');
var listFiles = require('./list-files');
var Logger = require('./logger');
var minimatches = require('./minimatches');
var Promise = require('./promise');
var log = Logger.create('wendy');

function timeSince(start) {
	var ms = Date.now() - start;
	return ms < 100 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's';
}

module.exports = function(execCommands) {
	var wendyStart = Date.now();

	files.init(minimatches(listFiles('.'), config.project.files));
	log.spam('Files:\n  %s', files.getPaths().join('\n  '));

	// Keep track of all processor promises to know when all async processing is resolved
	var processorPromises = [];

	// Processors selected through commands are turned into files task functions
	// These should return a Promise indicating they are done manipulating files
	var filesTasks = _.filter(commands.select(execCommands), 'processor').map(function(command) {
		var processorName = command.processor;
		var commandName = commands.getName(command);
		var shortName = commands.getName(command, true);
		var pConfig = _.extend(config[commandName] || {}, { project: config.project });
		var pLog = Logger.create(shortName);

		var processor = require('./processor/' + processorName + '.js');

		// Legacy processor
		if (processor instanceof Function) {
			return function() {
				var processorStart = Date.now();
				var inputPaths = pConfig.files ? minimatches(files.getPaths(), pConfig.files) : files.getPaths();
				var inputFiles = files.getList(inputPaths);
				var output = processor(pConfig, pLog, inputFiles);
				pLog.debug('Starting');
				bar.add(shortName);
				return Promise.resolve(output).then(function(outputFiles) {
					_.difference(outputFiles, inputFiles).forEach(function(file) {
						files.add(file);
					});
					_.difference(inputFiles, outputFiles).forEach(function(file) {
						files.remove(file);
					});
					pLog.info('Finished after: %s', timeSince(processorStart));
					bar.finish(shortName);
				});
			};
		}

		return function() {
			var processorStart;
			processor.init(pConfig, pLog);
			var inputPaths = pConfig.files ? minimatches(files.getPaths(), pConfig.files) : files.getPaths();
			var batches = processor.getBatches(inputPaths);
			var nrBatches = batches.length;
			pLog.debug('Starting %d batches', nrBatches);

			var batchPromises = batches.map(function(batch, batchIndex) {
				var inputs = batch.inputs;
				var outputs = batch.outputs;

				// Prepare input promises with data
				var inputPromises = inputs.map(function(input) {
					var file = files.get(input.path);
					if (!file) {
						throw new Error('File not found: ' + input.path);
					}
					return file.get(input.type).then(function(data) {
						input.data = data;
						return input;
					});
				});

				// Add or change files and prepare output data promises and callbacks
				var dataPromises = outputs.map(function(output) {
					var file = files.get(output.path) || files.add(output.path);
					return file.set(output.type, new Promise(function(resolve, reject) {
						output.resolve = resolve;
						output.reject = reject;
					}));
				});

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

					// TODO: Cache to improve incremental builds? (e.g: build/cache/<inputs hash>/<output files>)
					// TODO: Distribute process calls over this and other threads to improve multi-core performance?
					return processor.process(inputs, outputs);
				});

				// Remove files
				var inputPaths = _.pluck(_.filter(inputs, { isReadOnly: false }), 'path');
				var outputPaths = _.pluck(outputs, 'path');
				_.difference(inputPaths, outputPaths).forEach(function(removedPath) {
					files.remove(removedPath);
				});

				return Promise.all(dataPromises.concat(processPromise)).then(function() {
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
	var wendyPromise = filesTasks.reduce(function(prevPromise, task) {
		return prevPromise.then(task);
	}, Promise.resolve()).then(function() {
		// Wait for all (including async) processing to finish
		return Promise.all(processorPromises).then(function() {
			log.info('All finished after: %s', timeSince(wendyStart));
		});
	});

	wendyPromise.catch(function() {
		bar.reset();
		log.info('Rejected after: %s', timeSince(wendyStart));
	});

	return wendyPromise;
};
