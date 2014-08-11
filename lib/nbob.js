'use strict';

var _ = require('lodash');
var util = require('util');
var updateNotifier = require('update-notifier');
var pkg = require('../package.json');
var args = require('./args');
var commands = require('./commands');
var config = require('./config');
var help = require('./help');
var Logger = require('./logger');
var options = require('./options');
var wendy = require('./wendy');
var log = Logger.create('nbob');

// Encourage use of latest version
updateNotifier({ packageName: pkg.name, packageVersion: pkg.version }).notify();

// Change root log level here so optional 'silent' can immediately suppress following error logs
log.root.level = args.level;

// Display any config error
if (config.nbob.error) {
	help(config.nbob.error);
}

// Validate commands config
commands.getLeafs().forEach(function(command) {
	if (!command.description) {
		help('Invalid command config key or missing description: "%s"', commands.getName(command));
	}
});

// Validate option arguments
_.each(args, function(value, name) {
	if (name === '_') {
		return;
	}
	var option = _.find(options, { name: name });
	if (!option) {
		help('Invalid option name: %s', name);
	}
	var error = option.test && option.test(value);
	if (error) {
		help('Invalid option value: %s=\'%s\': %s', name, value, error);
	}
});

// Validate env option argument
var env = args.env;
if (env) {
	var envConfigMap = config.envConfigMap;
	var envConfig = envConfigMap[env];
	if (!envConfig) {
		help('Invalid option value: env=\'%s\', valid values: %s', env, Object.keys(envConfigMap));
	}
}

// Validate command arguments
var argCommands = args._.map(function(name) {
	return commands.find(name) || help('Invalid command: %s', name);
});
if (argCommands.length === 0) {
	help('No command(s) specified');
}

// Ensure project name is defined (e.g: by project config)
var selectedCommands = commands.select(argCommands);
var projectConfig = config.project;
var projectName = projectConfig.name;
var projectVersion = projectConfig.version;
if (selectedCommands.indexOf(commands.find('init:nbob')) < 0 && !projectName) {
	help('Project name is undefined (tip: $ nbob init:nbob)');
}

// TODO: Add support for displaying processor specific help
// Example: nbob -h deploy
// Asks related processor (deploy-s3) for help text and displays that
// Processor help should explain functionality and describe configuration options and any external dependencies

log.info('nBob v%s: %s v%s', pkg.version, projectName, projectVersion);
log.debug('Commands:', argCommands.map(function(command) {
	return commands.getName(command);
}).join(', '));
log.debug('Options:', _.omit(args, '_'));
log.debug('Config: %s', util.inspect(config, { depth: null }));

process.chdir(args.dir);
config.project.dir = args.dir;

wendy(argCommands).catch(function(error) {
	log.fatal(error);
});
