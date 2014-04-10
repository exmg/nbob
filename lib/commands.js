/*jshint node:true, strict:false*/

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

module.exports = [
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
