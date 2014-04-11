/*jshint node:true, strict:false*/

function pushArray(array, items) {
	Array.prototype.push.apply(array, items);
}

function Command(name, desc, processor) {
	this.name = name;
	this.desc = desc;
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
	return dependencies;
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
	return this.getDependencies().concat(this, this.getSubCommands());
};

module.exports = Command;
