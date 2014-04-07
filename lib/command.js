/*jshint node:true, strict:false*/

var _ = require('lodash');

function flatten(command, excludeRoot) {
	var base = excludeRoot ? [] : [ command ];
	return Array.prototype.concat.apply(base, command.subCommands.map(flatten));
}

function Command(name, desc, processor, subCommands) {
	this.name = name;
	this.desc = desc;
	this.processor = processor;
	this.subCommands = subCommands || [];

	// Prefix any sub commands with this command name
	this.flatten(true).forEach(function(command) {
		command.name = name + ':' + command.name;
	});
}

Command.prototype.flatten = function(excludeRoot) {
	return flatten(this, excludeRoot);
};

Command.prototype.getProcessors = function() {
	return _.pluck(_.filter(this.flatten(), 'processor'), 'processor');
};

module.exports = Command;
