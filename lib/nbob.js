'use strict';

// TODO: Use update-notifier to encourage use of latest version of nbob

// Monkey patch fs to work around "EMFILE, too many open files"
require('graceful-fs');

var util = require('util');
var pkg = require('../package.json');
var args = require('./args');
var commands = require('./commands');
var config = require('./config');
var Logger = require('./logger');
var wendy = require('./wendy');
var log = Logger.create('nbob');

var argCommands = args.commands;
if (argCommands.length === 0) {
	// TODO: Show brief help here, add option --help for showing full help
	log.help('No command(s) specified');
}

// TODO: Add support for displaying processor specific help
// Example: nbob -h deploy
// Asks related processor (deploy-s3) for help text and displays that
// Processor help should explain functionality and describe configuration options and any external dependencies

log.info('nBob v%s: %s v%s', pkg.version, config.project.name, config.project.version);
log.debug('Commands:', argCommands.map(function(command) {
	return commands.getName(command);
}).join(', '));
log.debug('Options:', args.options);
log.debug('Config: %s', util.inspect(config, { depth: null }));

process.chdir(args.options.dir);

wendy(argCommands).catch(function(error) {
	log.fatal(error);
});
