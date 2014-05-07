/*jshint node:true, strict:false*/

var _ = require('lodash');
var abbrev = require('abbrev');

var Command = require('./command');

var cmdAnalyze = new Command('analyze').addSubCommands([
	new Command('js').addSubCommands([
		new Command('hint', '*Analyze JS with JSHint', 'dummy'),
		new Command('style', '*Check JS coding style', 'dummy'),
		new Command('amd', '*Check EM AMD dependencies', 'dummy')
	]),
	new Command('l10n', '*Check localization', 'dummy')
]);

var cmdBuild = new Command('build').addSubCommands([
	new Command('l10n', '*Localize files', 'dummy'),
	new Command('templates', '*Concatenate templates', 'dummy'),
	new Command('css').addSubCommands([
		new Command('less', '*Compile LESS to CSS', 'dummy'),
		new Command('sass', '*Compile SASS to CSS', 'dummy'),
		new Command('base64', '*Inline images into CSS', 'dummy'),
		new Command('minify', '*Minify CSS', 'dummy')
	]),
	new Command('js').addSubCommands([
		new Command('es6', '*Transpile ES6 to ES5', 'dummy'),
		new Command('concat', '*Concatenate JS files', 'dummy'),
		new Command('amd', '*Optimize EM AMD modules', 'dummy'),
		new Command('minify', '*Minify JS', 'dummy')
	]),
	new Command('include', '*Include files', 'dummy'),
	new Command('substitute', '*Subtitute variables', 'dummy')
]);

var cmdTest = new Command('test', '*Run tests', 'dummy');

var commands = [
	new Command('init').addSubCommands([
		new Command('nbob', '*Create nbob-config.json', 'dummy'),
		new Command('hint', '*Create .jshintrc', 'dummy')
	]),
	new Command('update').addSubCommands([
		new Command('api', '*Update EM api directory', 'dummy'),
		new Command('doc', '*Update doc directory', 'dummy'),
		new Command('l10n', '*Update l10n directory', 'dummy'),
		new Command('lib', '*Update lib directory', 'dummy'),
		new Command('images', '*Optimize image files', 'dummy')
	]),
	new Command('clean', 'Remove build and dist directories', 'clean'),
	new Command('make', 'Analyze, build and test').addDependencies([
		cmdAnalyze,
		cmdBuild,
		cmdTest
	]),
	cmdAnalyze,
	cmdBuild,
	cmdTest,
	new Command('serve', '*Make and host files', 'dummy'),
	new Command('deploy', '*Copy a clean make to S3', 'dummy')
];

function find(names, list) {
	var head = names[0];
	var tail = _.tail(names);
	var abbreviationMap = abbrev(_.pluck(list, 'name'));
	head = abbreviationMap[head];
	var command = _.find(list, { name: head });
	return command && tail.length > 0 ? find(tail, command.subCommands) : command;
}

commands.find = function(name) {
	return find(name.split(':'), commands);
};

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
		var subName = getName(command, sub.subCommands, parts.concat(shorten ? shorten[sub.name] : sub.name));
		if (subName) {
			return subName;
		}
	}
}

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

module.exports = commands;
