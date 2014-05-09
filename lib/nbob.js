/*jshint node:true, strict:false*/

// TODO: Use update-notifier to encourage use of latest version of nbob
'use strict';

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var Promise = require('es6-promise').Promise;
var ProgressBar = require('progress');
var pkg = require('../package.json');
var commands = require('./commands');
var args = require('./args');
var config = require('./config');
var Logger = require('./logger');
var minimatches = require('./minimatches');
var File = require('./file');
var log = Logger.create('nbob');

function listFiles(dir) {
	var files = [];
	fs.readdirSync(dir).forEach(function(filePath) {
		filePath = path.join(dir, filePath);
		var stat = fs.lstatSync(filePath);
		if (stat && stat.isDirectory()) {
			files = files.concat(listFiles(filePath));
		} else {
			files.push(new File(filePath));
		}
	});
	return files;
}

function timeSince(start) {
	var ms = Date.now() - start;
	return ms < 100 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's';
}

var argCommands = args.commands;
if (argCommands.length === 0) {
	// TODO: Show brief help here, add option --help for showing full help
	log.help('No command(s) specified');
}

log.info('nBob v%s: %s v%s', pkg.version, config.name, config.version);
log.debug('Commands:', argCommands.map(function(command) {
	return commands.getName(command);
}).join(', '));
log.debug('Options:', args.options);
log.spam('Config:', config);

process.chdir(args.options.dir);

var processors = commands.select(argCommands).filter(function(command) {
	return command.processor;
}).map(function(command) {
	var processor = require('./processor/' + command.processor + '.js');
	var pConfig = config[commands.getName(command)];
	var pLog = Logger.create(commands.getName(command, true));
	processor.init(pConfig, pLog);
	return processor;
});

var barFormat = '[:bar] :percent :etas';
var bar = new ProgressBar(barFormat, { total: 0, incomplete: ' ' });
log.root.bar = bar; // hook bar to logger so it can keep it at bottom
bar.start = new Date(); // start manually (we do not use tick)
var activeCommandNames = [];

var files = listFiles('.');
files = minimatches(files, config.files);
files = _.sortBy(files, 'path');
log.spam('Files:\n  %s', _.pluck(files, 'path').join('\n  '));
var filesPromise = Promise.resolve(files);

// TODO: Cleanup this promise spaghetti
var processorPromises = [];
Promise.all(processors.map(function(processor) {
	var pLog = processor.log;
	var commandName = pLog.prefix.trim();
	var lastFilesPromise = filesPromise;

	filesPromise = new Promise(function(resolve, reject) {
		lastFilesPromise.then(function(files) {
			var batches = processor.getBatches(files);
			var batchesLen = batches.length;
			if (batchesLen === 0) {
				resolve(files);
				return;
			}

			activeCommandNames.push(commandName);
			bar.fmt = barFormat + ': ' + activeCommandNames.join(', ');
			bar.total += batchesLen;
			bar.width = bar.total;
			bar.render();

			var processorStart = Date.now();
			pLog.debug('Start: %d batches', batchesLen);
			pLog.pause();
			var processorPromise = Promise.all(batches.map(function(batch, i) {
				return processor.process(batch).then(function() {
					pLog.debug('Batch #%d: Done in %s', i + 1, timeSince(processorStart));
					bar.curr++;
					bar.render();
				});
			}));
			processorPromise.then(function() {
				pLog.resume();
				pLog.info('Finished: %d batches in %s', batchesLen, timeSince(processorStart));
				activeCommandNames = _.without(activeCommandNames, commandName);
			}, function(error) {
				pLog.resume();
				activeCommandNames = _.without(activeCommandNames, commandName);
				return Promise.reject(error);
			});
			processorPromises.push(processorPromise);

			Promise.all(_.pluck(batches, 'outputFilesPromise')).then(function(outputFilesList) {
				batches.forEach(function(batch, i) {
					var inputFiles = batch.inputFiles;
					var outputFiles = outputFilesList[i];
					var addedFiles = _.difference(outputFiles, inputFiles);
					var removedFiles = _.difference(inputFiles, outputFiles);
					files = _.difference(files.concat(addedFiles), removedFiles);
				});
				files = _.sortBy(files, 'path');
				resolve(files);
			}, reject);
		}, reject);
	});

	filesPromise.catch(function(error) {
		pLog.error(error);
	});

	return filesPromise;
})).then(function() {
	return Promise.all(processorPromises).then(function() {
		log.info('Finished in %s', timeSince(bar.start.getTime()));
	});
}).catch(function(error) {
	// TODO: Clean up progress bar or at least end on a clean new line
	log.error(error);
});

