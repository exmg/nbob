/*jshint node:true, strict:false*/

// TODO: Use update-notifier to encourage use of latest version of nbob
'use strict';

// Monkey patch fs to work around "EMFILE, too many open files"
require('graceful-fs');

var assert = require('assert');
var _ = require('lodash');
var Promise = require('./promise');
var pkg = require('../package.json');
var commands = require('./commands');
var args = require('./args');
var config = require('./config');
var Logger = require('./logger');
var files = require('./files');
var Processor = require('./processor');
var Schedule = require('./schedule');
var bar = require('./bar');
var log = Logger.create('nbob');

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

var schedule = new Schedule();
var readOnlyPromises = [];
_.filter(commands.select(argCommands), 'processor').forEach(function(command) {
	var processorName = command.processor;
	var commandName = commands.getName(command);
	var shortName = commands.getName(command, true);
	var pConfig = _.extend(config[commandName], { project: config.project });
	var pLog = Logger.create(shortName);
	var processorStart;

	var processor = require('./processor/' + processorName + '.js');
	if (processor instanceof Processor) {
		processor.init(pConfig, pLog);

		var batches = processor.getBatches(files.getPaths());

		var batchesLen = batches.length;
		var onFinishBatch = _.after(batchesLen, function onFinishBatches() {
			pLog.resume();
			pLog.info('Finished %d batches after: %s', batchesLen, timeSince(processorStart));
		});

		batches.forEach(function(batch, i) {
			var isReadOnly = batch.isReadOnly();

			bar.add(shortName);

			// TODO: Optimize by dividing across multiple cores using child_process.fork()
			// I'm thinking per batch, but sending file data back and forth to children might be inefficient.
			// Unfortunately, looking for shared memory modules I did not find anything good and cross platform.
			// Alternatively we could simply just fork read-only processors like jshint.
			schedule.addParallel(function() {
				var batchStart = Date.now();
				if (!processorStart) {
					processorStart = batchStart;
					pLog.debug('Start %d batches', batchesLen);
					pLog.pause();
				}

				var inputFileMap = files.getMap(batch.inputPaths);
				var promise = processor.process(batch, inputFileMap).then(function(outputFileMap) {
					if (isReadOnly) {
						assert.strictEqual(outputFileMap, undefined, 'Read only processor should return no output');
					} else {
						// TODO: assert that outputFileMap key equals the corresponding file.path
						var outputPaths = Object.keys(outputFileMap).sort();
						var batchOutputPaths = batch.outputPaths.slice().sort(); // slice to work around Object.freeze
						assert.deepEqual(outputPaths, batchOutputPaths, 'Processor output should match batch');

						files.process(inputFileMap, outputFileMap);
					}

					bar.finish(shortName);
					pLog.spam('Finished batch #%d after: %s', i + 1, timeSince(batchStart));
					onFinishBatch();
				}, function(error) {
					pLog.info('Rejected batch #%d after: %s', i + 1, timeSince(batchStart));
					onFinishBatch();
					return Promise.reject(error);
				});
				if (isReadOnly) {
					readOnlyPromises.push(promise);
					return Promise.resolve();
				}
				return promise;
			});
		});
	} else { // Legacy processor (processor instanceof Function)
		schedule.addSequential(function() {
			pLog.debug('Start');
			processorStart = Date.now();
			var inputFileMap = files.getMap();
			bar.add(shortName);
			var output = processor(pConfig, pLog, inputFileMap);
			return Promise.resolve(output).then(function(outputFileMap) {
				if (outputFileMap) {
					files.process(inputFileMap, outputFileMap);
				} else {
					// Re-initialize from file system to figure out what the situation is now
					files.init();
				}
				pLog.info('Finished after: %s', timeSince(processorStart));
				bar.finish(shortName);
			});
		});
	}
});

var scheduleStart = Date.now();
schedule.run().then(function() {
	log.debug('Run finished after: %s', timeSince(scheduleStart));
	return Promise.all(readOnlyPromises).then(function() {
		log.info('All finished after: %s', timeSince(scheduleStart));
	});
}).catch(function(error) {
	log.fatal(error);
});
