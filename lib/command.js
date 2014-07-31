'use strict';

function pushArray(array, items) {
	Array.prototype.push.apply(array, items);
}

function Command(name, description, processor) {
	this.name = name;
	this.description = description;
	this.processor = processor;
	this.dependencies = [];
	this.subCommands = [];
}

var proto = Command.prototype;

proto.addDependencies = function(dependencies) {
	pushArray(this.dependencies, dependencies);
	return this;
};

proto.getDependencies = function() {
	var dependencies = [];
	this.dependencies.forEach(function(dep) {
		pushArray(dependencies, dep.getDependencies());
		dependencies.push(dep);
	});
};

proto.addSubCommands = function(subCommands) {
	pushArray(this.subCommands, subCommands);
	return this;
};

proto.getSubCommands = function() {
	var subCommands = [];
	this.subCommands.forEach(function(sub) {
		subCommands.push(sub);
		pushArray(subCommands, sub.getSubCommands());
	});
	return subCommands;
};

proto.expand = function() {
	var commands = [];
	this.dependencies.forEach(function(dep) {
		pushArray(commands, dep.expand());
		commands.push(dep);
	});
	commands.push(this);
	this.subCommands.forEach(function(sub) {
		commands.push(sub);
		pushArray(commands, sub.expand());
	});
	return commands;
};

module.exports = Command;
