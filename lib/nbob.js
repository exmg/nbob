/*jshint node:true, strict:false*/

// TODO: Use update-notifier to encourage use of latest version of nbob

var pkg = require('../package.json');
var args = require('./args');
var config = require('./config');
var log = require('./log').create(''); // No/empty prefix for this main module
var options = args.options;
var commands = args.commands;

if (commands.length === 0) {
	log.help('No command(s) specified');
}

log.info('nBob v%s, project: %s v%s', pkg.version, config.name, config.version);
log.debug('Options:', options);
log.debug('Commands:', commands);
log.spam('Config:', config);
