'use strict';

var http = require('http');
var path = require('path');
var _ = require('lodash');
var Handlebars = require('../handlebars');
var Batch = require('../batch');
var File = require('../file');
var Processor = require('../processor');
var Promise = require('../promise');

function httpGetJSON(url) {
	return new Promise(function(resolve, reject) {
		http.get(url, function(response) {
			var body = '';
			response.setEncoding('utf8');
			response.on('data', function(chunk) {
				body += chunk;
			});
			response.on('end', function() {
				try {
					resolve(JSON.parse(body));
				} catch (error) {
					reject(new Error('Error parsing response as JSON for URL: ' + url));
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
		if ([ 'ObjectId', 'String' ].indexOf(type) >= 0) {
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

var processor = new Processor();

processor.getBatches = function() {
	this.log.info('Host: %s', this.config.host);
	return this.config.resources.map(function(resource) {
		return new Batch([], [ { path: resource.path, write: true } ], { doNotCache: true });
	});
};

processor.process = function(inputs, outputs) {
	var config = this.config;
	var templatePromise = this.templatePromise;

	if (!templatePromise) {
		this.log.info('Template: %s', config.template);
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
	var url = 'http://' + config.host + '/tester/?raw=1&resourceClass=' + clazz;
	// TODO: Fix getaddrinfo ENOTFOUND when you run 'nbob u m' (works fine if you run 'nbob u' and 'nbob m' separately)
	var dataPromise = httpGetJSON(url);

	return Promise.apply([ templatePromise, dataPromise ], function(template, data) {
		var methods = data.restCalls.sort(function(m1, m2) {
			return m1.methodName.localeCompare(m2.methodName);
		}).map(function(methodData) {
			convertTypes(methodData);

			var pathVars = methodData.pathVariables;
			var requestVars = methodData.requestVariable ? methodData.requestVariable.pojo.fieldsData : [];
			var queryVars = methodData.queryVariables;
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
				params: pathVars.concat(requestVars, queryVars),
				responseVar: responseVar
			};
		});
		var templateData = _.extend({}, resource, { methods: methods });
		output.resolve(template(templateData));
	});
};

module.exports = processor;
