/*jshint node:true, strict:false*/

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var options = require('./args').options;
var log = require('./log').create(__filename);

var configFn = 'nbob-config.json';
var homeSubDir = '.nbob';
var homeDir = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
var projectDir = path.resolve(options.dir);

function extend() {
	var args = _.toArray(arguments);
	args.push(function(a, b) {
		return _.isArray(a) ? a.concat(b) : (_.isObject(a) && _.isObject(b) ? extend(a, b) : b);
	});
	return _.extend.apply(_, args);
}

function read() {
	var fn = path.join.apply(path, arguments);
	try {
		return JSON.parse(fs.readFileSync(fn));
	} catch (e) {
		log.help('Error reading and parsing file: %s\n  %s', fn, e.message);
	}
}

// TODO: Warn if home config is group/world readable?

module.exports = extend(
	read(__dirname, '../' + configFn),
	read(homeDir, homeSubDir, configFn),
	read(projectDir, configFn)
);
