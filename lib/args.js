'use strict';

var _ = require('lodash');
var minimist = require('minimist');
var commands = require('./commands');
var options = require('./options');
var log = require('./logger').create('args');

var minOptions = {
	boolean: _.pluck(_.filter(options, 'bool'), 'name'),
	default: _.transform(_.filter(options, 'def'), function(defs, option) {
		defs[option.name] = option.def;
	}, {}),
	alias: _.transform(options, function(aliases, option) {
		aliases[option.name.substr(0, 1)] = option.name;
	}, {})
};
var args = minimist(process.argv.slice(2), minOptions);
args = _.omit(args, Object.keys(minOptions.alias));

// Change root log level here so optional 'silent' can immediately suppress following error logs
log.root.level = args.level;

var argOptions = _.omit(args, '_');
_.each(argOptions, function(value, name) {
	var option = _.find(options, { name: name });
	if (!option) {
		log.help('Invalid option name: ' + name);
	}
	var error = option.test && option.test(value);
	if (error) {
		log.help('Invalid option value: %s=\'%s\': %s', name, value, error);
	}
});

var argCommands = args._.map(function(name) {
	return commands.find(name) || log.help('Invalid command: ' + name);
});

module.exports = {
	options: argOptions,
	commands: argCommands
};
