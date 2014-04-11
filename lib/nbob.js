/*jshint node:true, strict:false*/

// TODO: Use update-notifier to encourage use of latest version of nbob

var Promise = require('es6-promise').Promise;
var pkg = require('../package.json');
var commands = require('./commands');
var args = require('./args');
var config = require('./config');
var log = require('./log').create('nbob');

var argCommands = args.commands;
if (argCommands.length === 0) {
	log.help('No command(s) specified');
}

log.info('nBob v%s: %s v%s', pkg.version, config.name, config.version);
log.debug('Options:', args.options);
log.spam('Config:', config);

commands.select(argCommands).forEach(function(command) {
	var commandName = commands.getName(command);
	var pLog = require('./log').create(commandName);

	var processor = command.processor;
	if (!processor) {
		return;
	}

	processor = require('./processor/' + processor + '.js');
	var paths = []; // TODO
	var batches = processor.getBatches(paths);

	// TODO: Replace by or add progress meters
	pLog.info('Start (%d batch%s)', batches.length, batches.length > 1 ? 'es' : '');
	pLog.pause();
	Promise.all(batches.map(function(batch, i) {
		return processor.process(pLog, batch).then(function() {
			pLog.debug('Batch #%d: Done', i + 1);
		});
	})).then(function() {
		pLog.info('Done!');
		pLog.resume();
	});
});
