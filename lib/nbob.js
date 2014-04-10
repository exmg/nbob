/*jshint node:true, strict:false*/

// TODO: Use update-notifier to encourage use of latest version of nbob

var _ = require('lodash');
var Promise = require('es6-promise').Promise;
var pkg = require('../package.json');
var args = require('./args');
var config = require('./config');
var log = require('./log').create(''); // No/empty prefix for this main module
var options = args.options;
var commands = args.commands;

if (commands.length === 0) {
	log.help('No command(s) specified');
}

log.info('nBob v%s: %s v%s: %s', pkg.version, config.name, config.version, _.pluck(commands, 'name').join(', '));
log.debug('Options:', options);
log.spam('Config:', config);

commands.forEach(function(commandInfo) {
	var commandName = commandInfo.name;
	var command = commandInfo.command;
	log.debug('Command: %s', commandName);

	command.getProcessors().forEach(function(processorName) {
		var pLog = require('./log').create(commandName + '::' + processorName);
		var processor = require('./processor/' + processorName + '.js');
		var paths = []; // TODO
		var batches = processor.getBatches(paths);

		// TODO: Replace by or add progress meters
		pLog.info('Start (%d batches)', batches.length);
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
});
