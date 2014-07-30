'use strict';

var _ = require('lodash');
var bar = require('./bar');
var cache = require('./cache');
var commands = require('./commands');
var config = require('./config');
var files = require('./files');
var fs2 = require('./fs2');
var getProcessor = require('./get-processor');
var listFiles = require('./list-files');
var Logger = require('./logger');
var md5hex = require('./md5hex');
var minimatches = require('./minimatches');
var Promise = require('./promise');
var scoop = require('./scoop');
var log = Logger.create('wendy');
var options = require('./args').options;

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

function unixPathJoin() {
	return _.toArray(arguments).join('/');
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

function processBatch(processor, inputs, outputs, multiCore) {
	var inputSize = 0;
	inputs.forEach(function(input) {
		switch (input.type) {
			// TODO: Re-enable in memory caching of text and json parsed buffer? (used to be in File)
			case 'buffer': input.data = input.buffer; break;
			case 'text': input.data = input.buffer.toString(); break;
			case 'json': input.data = JSON.parse(input.buffer.toString()); break;
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
			if (output.trackRatio) {
				processor.log.ok('%s (%s %s)', output.path, bytes(outputSize), percentage(outputSize, inputSize));
			} else {
				processor.log.ok('%s', output.path);
			}
		};
	});

	if (!options.xmulti && scoop.enabled && multiCore) {
		return scoop.process(processor, inputs, outputs);
	} else {
		return Promise.resolve(processor.process(inputs, outputs));
	}
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
		// TODO: Increase and improve use of cache module
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
								resolve(!output.write ? buffer : fs2.writeFile(output.path, buffer).then(function() {
									return buffer;
								}));
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
						var cacheDir = unixPathJoin(config.project.buildDir, pName, processInputDigest);
						var manifestPath = cacheDir + '.json';

						// TODO: Use a single manifest file per processor to reduce number of file reads/writes
						return cache.get(manifestPath).then(function(manifest) {
							return Promise.all(outputs.map(function(output) {
								var outputPath = unixPathJoin(cacheDir, output.path);
								var md5 = manifest[output.path];
								return cache.get(outputPath, md5).then(function(buffer) {
									output.resolve(buffer);
								});
							}));
						}, function() {
							return processBatch(processor, inputs, outputs, batch.multiCore).then(function() {
								return Promise.all(bufferPromises).then(function(buffers) {
									// Cache batch if not disabled and everything resolves
									if (batch.doNotCache) {
										return;
									}
									var manifest = {};
									buffers.forEach(function(buffer, i) {
										var output = outputs[i];
										var outputPath = unixPathJoin(cacheDir, output.path);
										var md5 = md5hex(buffer);
										manifest[output.path] = md5;
										cache.set(outputPath, buffer, md5);
									});
									cache.setObject(manifestPath, manifest);
								});
							});
						}).then(function() {
							pLog.spam('Finished batch #%d after: %s', batchIndex, timeSince(batchStart));
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
			scoop.cleanup();

			// TODO: Remove this testing code once things are optimized
			log.info('### fs2 nrReads: %d, nrWrites: %d', fs2.reads.length, fs2.writes.length);
			fs2.reads.sort().forEach(function(read) {
				log.debug('Read: %s', read);
			});
			fs2.writes.sort().forEach(function(write) {
				log.debug('Wrote: %s', write);
			});
			fs2.reads.length = 0;
			fs2.writes.length = 0;
		});
	});

	wendyPromise.catch(function() {
		bar.reset();
		log.info('Rejected after: %s', timeSince(wendyStart));
		scoop.cleanup();
	});

	return wendyPromise;
};
