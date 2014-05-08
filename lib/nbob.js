/*jshint node:true, strict:false*/

// TODO: Use update-notifier to encourage use of latest version of nbob
'use strict';

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var Promise = require('es6-promise').Promise;
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

var nrBatches = 0;
var nrBatchesDone = 0;
var activeCommandNames = [];
function repeatString(str, nr) {
	var repeated = '';
	for (var i = 0; i < nr; i++) {
		repeated += str;
	}
	return repeated;
}
var showProgress = _.debounce(function() {
	// TODO: Replace by a single, dynamic, pretty progress bar
	log.info('Progress: [%s%s] %d/%d %s',
		repeatString('=', nrBatchesDone),
		repeatString('-', nrBatches - nrBatchesDone),
		nrBatchesDone, nrBatches,
		activeCommandNames.join(', ')
	);
}, 0);

var files = listFiles('.');
files = minimatches(files, config.files);
files = _.sortBy(files, 'path');
log.spam('Files:\n  %s', _.pluck(files, 'path').join('\n  '));
var filesPromise = Promise.resolve(files);

processors.forEach(function(processor) {
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
			nrBatches += batchesLen;
			showProgress();

			var batchStart = Date.now();
			pLog.debug('Start: %d batches', batchesLen);
			pLog.pause();
			Promise.all(batches.map(function(batch, i) {
				return processor.process(batch).then(function() {
					pLog.debug('Batch #%d: Done (%dms)', i + 1, Date.now() - batchStart);
					nrBatchesDone++;
					showProgress();
				});
			})).then(function() {
				pLog.resume();
				pLog.info('Finished: %d batches (%dms)', batchesLen, Date.now() - batchStart);
				activeCommandNames = _.without(activeCommandNames, commandName);
			}, reject);

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
		});
	});

	filesPromise.catch(function(error) {
		log.error(error);
	});
});

