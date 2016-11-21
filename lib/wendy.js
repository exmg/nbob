'use strict';

var _ = require('lodash');
var pkg = require('../package.json');
var commands = require('./commands');
var config = require('./config').object;
var cache = {};
var files = require('./files');
var fs2 = require('./fs2');
var getProcessor = require('./get-processor');
var jsonParse = require('./json-parse');
var listFiles = require('./list-files');
var Logger = require('./logger');
var md5hex = require('./md5hex');
var minimatches = require('./minimatches');
var Promise = require('./promise');
var scoop = require('./scoop');
var log = Logger.create('wendy');

function timeSince(start) {
	var ms = Date.now() - start;
	return ms < 100 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's';
}

function bytes(nr) {
	return (nr / 1024).toFixed(1) + 'K';
}

function percentage(a, b) {
	return (b ? (a * 100 / b).toFixed(1) : '∞') + '%';
}

function processLegacy(inputPaths, processor, pConfig, pLog) {
	var inputFiles = files.getList(inputPaths);
	var outputFilesPromise = processor(pConfig, pLog, inputFiles);
	return Promise.resolve(outputFilesPromise).then(function(outputFiles) {
		_.difference(outputFiles, inputFiles).forEach(function(file) {
			pLog.ok('%s (added)', file.path);
			files.add(file);
		});
		_.difference(inputFiles, outputFiles).forEach(function(file) {
			pLog.ok('%s (removed)', file.path);
			files.remove(file);
		});
	});
}

function processBatch(processor, inputs, outputs, multiCore) {
	var inputSize = 0;
	inputs.forEach(function(input) {
		switch (input.type) {
			// TODO: Re-enable in memory caching of text and json parsed buffer? (used to be in File)
			case 'buffer': input.data = input.buffer; break;
			case 'text': input.data = input.buffer.toString(); break;
			case 'json': input.data = jsonParse(input.path, input.buffer.toString()); break;
			default: throw new Error('Invalid type: ' + input.type);
		}
		if (input.trackRatio) {
			inputSize += input.buffer.length;
		}
		delete input.buffer;
	});

	outputs.forEach(function(output) {
		var resolve = output.resolve;
		output.resolve = function(data) {
			var buffer;
			switch (output.type) {
				case 'buffer': buffer = data; break;
				case 'text': buffer = new Buffer(data); break;
				case 'json': buffer = new Buffer(JSON.stringify(data, null, '\t')); break;
				default: throw new Error('Invalid type: ' + output.type);
			}
			resolve(buffer);
			var outputSize = buffer.length;
			// TODO: Only log when file was added or changed?
			if (output.trackRatio) {
				processor.log.ok('%s (%s %s)', output.path, bytes(outputSize), percentage(outputSize, inputSize));
			} else {
				processor.log.ok('%s', output.path);
			}
		};
	});

	if (multiCore && scoop.enabled) {
		return scoop.process(processor, inputs, outputs);
	} else {
		return Promise.resolve(processor.process(inputs, outputs));
	}
}

module.exports = function(execCommands) {
	var wendyStart = Date.now();

	files.init(listFiles('.', config.project.files));
	log.spam('Files:\n  %s', files.getPaths().join('\n  '));

	// Keep track of all processor promises to know when all async processing is resolved
	var processorPromises = [];

	// Processors selected through commands are turned into files task functions
	// These should return a Promise indicating they are done manipulating files
	var filesTasks = _.filter(commands.select(execCommands), 'processor').map(function(command) {
		var pName = command.processor;
		var commandName = commands.getName(command);
		var shortName = commands.getName(command, true);
		var pConfig = _.extend({}, config[commandName], { project: config.project });
		var pLog = Logger.create(shortName);

		var processor = getProcessor(pName, pConfig, pLog);

		// Legacy processor
		// TODO: Create LegacyProcessor that wraps this flow into a regular processor.getBatches() call
		if (processor instanceof Function) {
			return function() {
				return Promise.all(processorPromises).then(function() {
					var inputPaths = pConfig.files ? minimatches(files.getPaths(), pConfig.files) : files.getPaths();
					var processorStart = Date.now();
					pLog.debug('Starting');
					pLog.addWork(1);
					return processLegacy(inputPaths, processor, pConfig, pLog).then(function() {
						pLog.info('Finished after: %s', timeSince(processorStart));
						pLog.completeWork(1);
					}, function(error) {
						error.commandName = commandName;
						error.command = command;
						error.processor = { name: pName };
						error.originalMessage = error.message;
						error.message = commandName + ': ' + error.message;
						throw error;
					});
				});
			};
		}

		// TODO: Clean and split up this code to make it more readable/manageable
		return function() {
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
					var multiCore = config.nbob.multiCore && batch.multiCore;

					// Prepare input promises
					var inputPromises = inputs.map(function(input) {
						var file = files.get(input.path);
						if (!file) {
							pLog.warn('Batch: %s', JSON.stringify(batch, null, '\t'));
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
						var outputPath = output.path;
						var file = files.get(outputPath) || files.add(outputPath);
						return file.setBuffer(new Promise(function(resolve, reject) {
							output.resolve = function(buffer) {
								resolve(
									!output.write ? buffer :
									// Note: Using file.getMD5() (even with proper guarding) hangs nBob
									fs2.readFile(outputPath).then(md5hex, function() {
										return undefined; // MD5 of non-existing file should not be a failure
									}).then(function(oldMD5) {
										return md5hex(buffer) === oldMD5 ? buffer :
											fs2.writeFile(outputPath, buffer).then(function() {
												return buffer;
											});
									})
								);
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
							pLog.addWork(nrBatches);
						}
						var batchStart = Date.now();
						pLog.spam('Starting batch #%d: %s => %s', batchIndex,
							_.pluck(inputs, 'path').join(', '), outputPaths.join(', '));

						// Combination of file paths and md5s should provide a suitable md5 for these inputs
						// It also reduces overhead of md5 calculation by enabling in memory caching of input md5s
						var inputsDigestData = inputs.map(function(input) {
							return input.path + input.md5;
						});
						// Do not forget to take other output factors into account
						var processInputDigest = md5hex([
							pkg.version, pName, JSON.stringify(pConfig)
						].concat(inputsDigestData), 'utf8');

						// TODO: Cache File instances including their MD5 digest
						// and further simplify and optimize all of the processing based on using File
						var cached = cache[processInputDigest];
						var batchPromise;
						if (cached) {
							outputs.forEach(function(output) {
								output.resolve(cached[output.path]);
							});
							batchPromise = Promise.resolve();
						} else {
							batchPromise = processBatch(processor, inputs, outputs, multiCore).then(function() {
								return Promise.all(bufferPromises).then(function(buffers) {
									if (batch.doNotCache) {
										return;
									}
									var map = {};
									buffers.forEach(function(buffer, i) {
										var outputPath = outputs[i].path;
										log.spam('Caching: %s', outputPath);
										map[outputPath] = buffer;
									});
									cache[processInputDigest] = map;
								});
							});
						}

						batchPromise.then(function() {
							pLog.spam('Finished batch #%d after: %s%s',
								batchIndex, timeSince(batchStart), cached ? ' (cached)' : '');
							pLog.completeWork(1);
						}, function(error) {
							error.commandName = commandName;
							error.command = command;
							error.processor = processor;
							error.originalMessage = error.message;
							error.message = commandName + ': ' + error.message;
							if (processor.documentation) {
								error.message += '\nDocumentation: ' + processor.documentation;
							}
							throw error;
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
			scoop.cleanup();
		});
	});

	wendyPromise.catch(function() {
		Logger.finishAllWork();
		log.info('Rejected after: %s', timeSince(wendyStart));
		scoop.cleanup();
	});

	return wendyPromise;
};
