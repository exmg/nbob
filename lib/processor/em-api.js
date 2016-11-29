'use strict';

var http = require('http');
var https = require('https');
var path = require('path');
var _ = require('lodash');
var Handlebars = require('../handlebars');
var Batch = require('../batch');
var File = require('../file');
var jsonParse = require('../json-parse');
var Processor = require('../processor');
var Promise = require('../promise');

function httpGetJSON(url) {
	return new Promise(function(resolve, reject) {
		var protocol = url.indexOf('https') === 0 ? https : http;
		protocol.get(url, function(response) {
			var body = '';
			response.setEncoding('utf8');
			response.on('data', function(chunk) {
				body += chunk;
			});
			response.on('end', function() {
				try {
					resolve(jsonParse(url, body));
				} catch (error) {
					reject(error);
				}
			});
		}).on('error', function(error) {
			error.message += ', url: ' + url;
			reject(error);
		});
	});
}

function convertTypes(data) {
	if (data.typeShort) {
		var type = data.typeShort;
		if ([ 'String', 'ObjectId', 'Key' ].indexOf(type) >= 0) {
			type = 'string';
		}
		if ([ 'Integer', 'int', 'long' ].indexOf(type) >= 0) {
			type = 'number';
		}
		if ([ 'ARRAY', 'LIST' ].indexOf(data.collectionType) >= 0) {
			type = '[' + type + ']';
		}
		data.type = type;
	}
	if (_.isObject(data)) {
		_.each(data, function(value) {
			convertTypes(value);
		});
	}
}

// Before the "url" option, including support for specifying http/https protocol we used to have the "host" option
function backwardsCompatibility(config) {
	if (!config.url && config.host) {
		config.url = 'http://' + config.host;
	}
	return config;
}

var processor = new Processor();

processor.getBatches = function() {
	var config = backwardsCompatibility(this.config);
	this.log.info('URL: %s', config.url);
	return config.resources.map(function(resource) {
		return new Batch([], [ { path: resource.path, write: true } ], { doNotCache: true });
	});
};

processor.process = function(inputs, outputs) {
	var log = this.log;
	var config = backwardsCompatibility(this.config);
	var templatePromise = this.templatePromise;

	if (!templatePromise) {
		log.info('Template: %s', config.template);
		var templateFile = new File(path.join(__dirname, '..', '..', 'res', 'em-api', config.template + '.js.hbs'));
		templatePromise = this.templatePromise = templateFile.getText().then(function(text) {
			return Handlebars.compile(text);
		});
	}

	var output = outputs[0];
	var resource = _.find(config.resources, function(candidate) {
		return candidate.path === output.path;
	});
	var clazz = resource['class'];
	var url = config.url + '/tester/?raw=1&resourceClass=' + clazz;
	log.debug(clazz);
	var dataPromise = httpGetJSON(url);

	return Promise.apply([ templatePromise, dataPromise ], function(template, data) {
		var methods = data.restCalls.sort(function(m1, m2) {
			return m1.methodName.localeCompare(m2.methodName);
		}).map(function(methodData) {
			convertTypes(methodData);

			var pathVars = methodData.pathVariables;
			var queryVars = methodData.queryVariables;
			var requestVars = methodData.requestVariable ? methodData.requestVariable.pojo.fieldsData : [];
			var requestDTOs = requestVars.filter(function(variable) {
				return variable.pojo ? true : false;
			});
			queryVars.forEach(function(variable) {
				variable.optional = true;
			});
			var responseVar = methodData.responseVariable || { type: 'Object' };
			return {
				moduleName: resource.moduleName,
				name: methodData.methodName,
				url: methodData.path.substr(1), // strip leading '/'
				type: methodData.type,
				pathVars: pathVars,
				queryVars: queryVars,
				requestVars: requestVars,
				requestDTOs: requestDTOs,
				params: pathVars.concat(requestVars, queryVars),
				responseVar: responseVar
			};
		});
		var templateData = _.extend({}, resource, { methods: methods });
		output.resolve(template(templateData));
	});
};

module.exports = processor;
