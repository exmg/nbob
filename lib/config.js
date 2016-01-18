'use strict';

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var args = require('./args');
var jsonParse = require('./json-parse');

var configFn = 'nbob-config.json';
var homeSubDir = '.nbob';
var homeDir = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
var projectDir = path.resolve(args.dir);
var configPaths = [
	path.join(__dirname, '../' + configFn),
	path.join(homeDir, homeSubDir, configFn),
	path.join(projectDir, configFn)
];
var config = {};

function getValue(obj, path) {
	var i = path.indexOf('.');
	var head = path.substr(0, i);
	var tail = path.substr(i + 1);
	return head ? getValue(obj[head], tail) : obj[path];
}

function setValue(obj, path, value) {
	var i = path.indexOf('.');
	var head = path.substr(0, i);
	var tail = path.substr(i + 1);
	if (head) {
		setValue(obj[head], tail, value);
	} else {
		obj[path] = value;
	}
}

function subst(subj, obj) {
	if (_.isObject(subj)) {
		// Recurse
		_.each(subj, function(value, key) {
			subj[key] = subst(value, obj);
		});
		return subj;
	} else if (_.isString(subj)) {
		// Substitute by object value
		// TODO: Reconsider support for this; it does not mix well with the extend and then substitute flow
		if (/^\{\{\> (.+?)}}$/.test(subj)) {
			return getValue(obj, RegExp.$1);
		}
		// Substitute by string
		return subj.replace(/\{\{(.+?)}}/g, function(match, path) {
			return getValue(obj, path);
		});
	} else { // number, boolean, ..
		return subj;
	}
}

function extend() {
	var args = _.toArray(arguments);
	args.push(function(a, b) {
		if (_.isArray(a)) {
			b = _.isArray(b) ? b : [ b ];
			// If first item equals !! then override array instead of extending it
			return b[0] === '!!' ? b.slice(1) : a.concat(b);
		}
		return _.isObject(a) && _.isObject(b) ? extend(a, b) : b;
	});
	return _.extend.apply(_, args);
}

function read(fn) {
	var text;
	try {
		// TODO: Make this (and everything that depends on this!) async
		text = fs.readFileSync(fn).toString();
	} catch (e) {
		return {};
	}
	try {
		return jsonParse(fn, text);
	} catch (e) {
		return { nbob: { error: e.message } };
	}
}

function update() {
	Object.keys(config).forEach(function(key) {
		delete config[key];
	});

	extend.apply(null, [ config ].concat(configPaths.map(read)));

	var env = args.env;
	if (env) {
		var envConfig = config.envConfigMap[env];
		if (envConfig) {
			extend(config, envConfig);
		}
	}

	if (/(.*)=(.*)/.test(args.option)) {
		var path = RegExp.$1;
		var value = RegExp.$2;
		var oldValue = getValue(config, path);
		if (typeof oldValue === 'boolean') {
			value = value === 'true' || value === '1' ? true : false;
		} else if (typeof oldValue === 'number') {
			value = parseFloat(value);
		}
		setValue(config, path, value);
	}

	subst(config, config);
}

update();

module.exports = {
	object: config,
	paths: configPaths,
	update: update
};
