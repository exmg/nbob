/*jshint node:true, strict:false*/

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var log = require('npmlog');
var options = require('./args').options;

var configFn = 'nbob-config.json';
var homeSubDir = '.nbob';
var homeDir = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
var projectDir = path.resolve(options.dir);

function extendConfig() {
	var args = _.toArray(arguments);
	args.push(function(a, b) {
		return _.isArray(a) ? a.concat(b) : (_.isObject(a) && _.isObject(b) ? extendConfig(a, b) : b);
	});
	return _.extend.apply(_, args);
}

function readConfig() {
	var fn = path.join.apply(path, arguments);
	try {
		return JSON.parse(fs.readFileSync(fn));
	} catch (e) {
		log.error('Error reading config file: ' + fn + '\n' + e);
		process.exit(1);
	}
}

module.exports = extendConfig(
	readConfig(__dirname, '../' + configFn),
	readConfig(homeDir, homeSubDir, configFn),
	readConfig(projectDir, configFn)
);
