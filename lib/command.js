/*jshint node:true, strict:false*/

var _ = require('lodash');

function Command(name, desc, processor) {
	this.name = name;
	this.desc = desc;
	this.processor = processor;
	this.dependencies = [];
	this.subCommands = [];
}

var proto = Command.prototype;
var concat = Array.prototype.concat;

proto.addDependencies = function(dependencies) {
	this.dependencies.push.apply(this.dependencies, dependencies);
	return this;
};

proto.getDependencies = function(recurse) {
	var dependencies = this.dependencies;
	return !recurse ? dependencies : concat.apply(dependencies, dependencies.map(function(dep) {
		return dep.getDependencies();
	}));
};

proto.addSubCommands = function(subCommands) {
	this.subCommands.push.apply(this.subCommands, subCommands);
	return this;
};

proto.getSubCommands = function(recurse) {
	var subCommands = this.subCommands;
	return !recurse ? subCommands : concat.apply(subCommands, subCommands.map(function(sub) {
		return sub.getSubCommands();
	}));
};

proto.getProcessors = function() {
	var commands = concat.call(this.getDependencies(true), this, this.getSubCommands(true));
	return _.pluck(_.filter(commands, 'processor'), 'processor');
};

module.exports = Command;
