/*jshint node:true, strict:false*/

var _ = require('lodash');
var abbrev = require('abbrev');
var minimist = require('minimist');
var commands = require('./commands');
var options = require('./options');
var log = require('./log').create('args');

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

function findCommand(parts, subCommands, fullParts) {
	var head = parts[0];
	var tail = _.tail(parts);
	var abbreviationMap = abbrev(_.pluck(subCommands, 'name'));
	head = abbreviationMap[head];
	var command = _.find(subCommands, { name: head });
	if (command) {
		fullParts.push(command.name);
	}
	return command && tail.length > 0 ? findCommand(tail, command.subCommands, fullParts) : {
		name: fullParts.join(':'),
		command: command
	};
}

var argCommands = args._;
argCommands.forEach(function(name, i) {
	var command = findCommand(name.split(':'), commands, []);
	if (!command) {
		log.help('Invalid command: ' + name);
	}
	// Replace abbreviated command name by full name and command reference
	argCommands[i] = command;
});

module.exports = {
	options: argOptions,
	commands: argCommands
};
