'use strict';

var _ = require('lodash');
var abbrev = require('abbrev');
var config = require('./config');
var Command = require('./command');

var commands = [];

function find(names, list) {
	var head = names[0];
	var tail = _.tail(names);
	var abbreviationMap = abbrev(_.pluck(list, 'name'));
	head = abbreviationMap[head];
	var command = _.find(list, { name: head });
	return command && tail.length > 0 ? find(tail, command.subCommands) : command;
}

function getName(command, list, parts, shorten) {
	if (list.indexOf(command) !== -1) {
		return parts.concat(command.name).join(':');
	}

	if (shorten) {
		var lengthenMap = abbrev(_.pluck(list, 'name'));
		shorten = {};
		_.each(lengthenMap, function(name, abbrev) {
			if (!shorten[name]) {
				shorten[name] = abbrev;
			}
		});
	}

	for (var i = 0; i < list.length; i++) {
		var sub = list[i];
		var subParts = parts.concat(shorten ? shorten[sub.name] : sub.name);
		var subName = getName(command, sub.subCommands, subParts, shorten);
		if (subName) {
			return subName;
		}
	}
}

commands.find = function(name) {
	return find(name.split(':'), commands);
};

commands.getName = function(command, shorten) {
	return getName(command, commands, [], shorten);
};

commands.select = function(list) {
	var expanded = _.flatten(list.map(function(command) {
		return command.expand();
	}));
	var ordered = _.flatten(commands.map(function(command) {
		return [ command ].concat(command.getSubCommands());
	}));
	return ordered.filter(function(command) {
		return expanded.indexOf(command) !== -1;
	});
};

commands.getLeafs = function(list) {
	list = list || commands;
	var leafs = [];
	list.forEach(function(command) {
		var subCommands = command.getSubCommands();
		if (subCommands.length > 0) {
			leafs = leafs.concat(commands.getLeafs(subCommands));
		} else {
			leafs.push(command);
		}
	});
	return leafs;
};

// Derive Commands from config
_.each(_.omit(config, 'nbob', 'project', 'envConfigMap'), function(commandConfig, commandName) {
	/*jshint maxdepth:10*/
	var names = commandName.split(':');
	var nrNames = names.length;
	var parentCommands = commands;
	var i, name, child;
	for (i = 0; i < nrNames; i++) {
		name = names[i];
		child = _.find(parentCommands, { name: name });
		if (!child) {
			if (i < nrNames - 1) {
				child = new Command(name); // intermediate command
			} else {
				child = new Command(name, commandConfig.description, commandConfig.processor);
			}
			parentCommands.push(child);
		}
		parentCommands = child.subCommands;
	}
});

// Add dependencies defined in config to Commands
commands.forEach(function(command) {
	var commandConfig = config[command.name] || {};
	var depNames = commandConfig.dependencies || [];
	command.dependencies = depNames.map(function(depName) {
		return find(depName.split(':'), commands);
	});
});

module.exports = commands;
