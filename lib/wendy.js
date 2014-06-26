'use strict';

var fs = require('fs');
var _ = require('lodash');
var path = require('path');
var bar = require('./bar');
var commands = require('./commands');
var config = require('./config');
var files = require('./files');
var listFiles = require('./list-files');
var Logger = require('./logger');
var md5hex = require('./md5hex');
var minimatches = require('./minimatches');
var Promise = require('./promise');
var promisify = require('./promisify');
var mkdirp = promisify(require('mkdirp'));
var lstat = promisify(fs.lstat);
var readFile = promisify(fs.readFile);
var writeFile = promisify(fs.writeFile);
var log = Logger.create('wendy');

function timeSince(start) {
	var ms = Date.now() - start;
	return ms < 100 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's';
}

function processLegacy(inputPaths, processor, pConfig, pLog) {
	var inputFiles = files.getList(inputPaths);
	var outputFilesPromise = processor(pConfig, pLog, inputFiles);
	return Promise.resolve(outputFilesPromise).then(function(outputFiles) {
		_.difference(outputFiles, inputFiles).forEach(function(file) {
			files.add(file);
		});
		_.difference(inputFiles, outputFiles).forEach(function(file) {
			files.remove(file);
		});
	});
}

function processBatch(processor, inputs, outputs) {
	inputs.forEach(function(input) {
		switch (input.type) {
			// TODO: Re-enable in memory caching of text and json parsed buffer? (used to be in File)
			case 'buffer': input.data = input.buffer; break;
			case 'text': input.data = input.buffer.toString(); break;
			case 'json': input.data = JSON.parse(input.buffer.toString()); break;
			default: throw new Error('Invalid type: ' + input.type);
		}
		delete input.buffer;
	});

	outputs.forEach(function(output) {
		var resolve = output.resolve;
		output.resolve = function(data) {
			switch (output.type) {
				case 'buffer': resolve(data); break;
				case 'text': resolve(new Buffer(data)); break;
				case 'json': resolve(new Buffer(JSON.stringify(data, null, '\t'))); break;
				default: throw new Error('Invalid type: ' + output.type);
			}
			processor.log.ok(output.path);
		};
	});

	// TODO: Distribute process calls over this and other threads to improve multi-core performance?
	return Promise.resolve(processor.process(inputs, outputs));
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
		var pConfig = _.extend({}, config[commandName], { project: config.project });
		var pLog = Logger.create(shortName);

		// TODO: Instantiate Processor here instead of in processor module so they do not depend on nbob
		var processor = require('./processor/' + processorName);

		// Legacy processor
		// TODO: Create LegacyProcessor that wraps this flow into a regular processor.getBatches() call
		if (processor instanceof Function) {
			return function() {
				var inputPaths = pConfig.files ? minimatches(files.getPaths(), pConfig.files) : files.getPaths();
				var processorStart = Date.now();
				pLog.debug('Starting');
				bar.add(shortName);
				return processLegacy(inputPaths, processor, pConfig, pLog).then(function() {
					pLog.info('Finished after: %s', timeSince(processorStart));
					bar.finish(shortName);
				});
			};
		}

		// TODO: Clean and split up this code to make it more readable/manageable
		// TODO: Improve caching approach to reduce number of files and amount of data read
		// E.g: Cache MD5 values of files in <cacheDir>.json and make file reading lazy
		return function() {
			if (!processor.initialized) {
				processor.init(pConfig, pLog);
			}

			var processorStart;
			var inputPaths = pConfig.files ? minimatches(files.getPaths(), pConfig.files) : files.getPaths();
			var batchesPromise = Promise.resolve(processor.getBatches(inputPaths, files.getList(inputPaths)));

			return batchesPromise.then(function(batches) {
				var nrBatches = batches.length;
				if (nrBatches === 0) {
					return;
				}
				pLog.debug('Starting %d batches', nrBatches);

				var batchPromises = batches.map(function(batch, batchIndex) {
					var inputs = batch.inputs;
					var outputs = batch.outputs;

					// Prepare input promises
					var inputPromises = inputs.map(function(input) {
						var file = files.get(input.path);
						if (!file) {
							throw new Error('File not found: ' + input.path + ', for command: ' + commandName);
						}
						return Promise.apply([ file.getBuffer(), file.getMD5() ], function(buffer, md5) {
							input.buffer = buffer;
							input.md5 = md5;
							return input;
						});
					});

					// Use existing or add new files and prepare output buffer promises and callbacks
					var bufferPromises = outputs.map(function(output) {
						var file = files.get(output.path) || files.add(output.path);
						return file.setBuffer(new Promise(function(resolve, reject) {
							output.resolve = function(buffer) {
								resolve(output.write ? writeFile(output.path, buffer) : buffer);
							};
							output.reject = reject;
						}));
					});

					// Remove files
					var inputPaths = _.pluck(_.filter(inputs, { isReadOnly: false }), 'path');
					var outputPaths = _.pluck(outputs, 'path');
					_.difference(inputPaths, outputPaths).forEach(function(removedPath) {
						files.remove(removedPath);
					});

					// Wait for input buffers to become available and start processing
					return Promise.all(inputPromises).then(function(inputs) {
						if (!processorStart) {
							processorStart = Date.now();
							bar.add(shortName, nrBatches);
						}
						var batchStart = Date.now();
						pLog.spam('Starting batch #%d: %s => %s', batchIndex,
							_.pluck(inputs, 'path').join(', '), outputPaths.join(', '));

						// Combination of file paths and md5s should provide a suitable md5 for these inputs
						// It also reduces overhead of md5 calculation by enabling in memory caching of input md5s
						var inputsDigestData = inputs.map(function(input) {
							return input.path + input.md5;
						});
						var processInputDigest = md5hex([ JSON.stringify(pConfig) ].concat(inputsDigestData), 'utf8');
						var cacheDir = path.join(config.project.buildDir, processorName, processInputDigest);
						var wasCached;

						return lstat(cacheDir).then(function() {
							wasCached = true;
							outputs.forEach(function(output) {
								var outputPath = path.join(cacheDir, output.path);
								readFile(outputPath).then(output.resolve, function(error) {
									error.message = 'Cache is invalid, please clean and try again: ' + error.message;
									output.reject(error);
								});
							});
							return Promise.all(bufferPromises);
						}, function() {
							wasCached = false;
							return processBatch(processor, inputs, outputs).then(function() {
								return Promise.all(bufferPromises).then(function(buffers) {
									// Cache batch if not disabled and everything resolves
									// Note: create cache dir even if it is empty to enable caching of read-only batches
									// Note: do not block or reject on writing away cache files
									if (batch.doNotCache) {
										return;
									}
									mkdirp(cacheDir);
									buffers.forEach(function(buffer, i) {
										var outputPath = path.join(cacheDir, outputs[i].path);
										mkdirp(path.dirname(outputPath)).then(function() {
											writeFile(outputPath, buffer);
											log.spam('Cached: %s', outputPath);
										});
									});
								});
							});
						}).then(function() {
							pLog.spam('Finished batch #%d after: %s%s',
								batchIndex, timeSince(batchStart), wasCached ? ' (cached)' : '');
							bar.finish(shortName);
						});
					});
				});

				var processorPromise = Promise.all(batchPromises);
				processorPromise.then(function() {
					pLog.info('Finished %d batches after: %s', nrBatches, timeSince(processorStart));
				});
				processorPromises.push(processorPromise);

				// All files changes have been made already (add, remove, path change, setBuffer promise)
				// So we implicitly resolve this task now, allowing following tasks to start
			});
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
