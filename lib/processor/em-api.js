'use strict';

var fs = require('fs');
var http = require('http');
var path = require('path');
var _ = require('lodash');
var Handlebars = require('../handlebars');
var Batch = require('../batch');
var Processor = require('../processor');
var Promise = require('../promise');

function httpGetJSON(url) {
	return new Promise(function(resolve) {
		http.get(url, function(response) {
			var body = '';
			response.setEncoding('utf8');
			response.on('data', function(chunk) {
				body += chunk;
			});
			response.on('end', function() {
				resolve(JSON.parse(body));
			});
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

processor.init = function(config) {
	Processor.prototype.init.apply(this, arguments);

	// Load specified template from nbob
	var templatePath = path.join(__dirname, '..', '..', 'res', 'em-api', config.template + '.js.hbs');
	this.template = Handlebars.compile('' + fs.readFileSync(templatePath));
};

processor.getBatches = function() {
	this.log.info(this.config.host);
	return this.config.resources.map(function(resource) {
		return new Batch([], [ { path: resource.path, write: true } ], { doNotCache: true });
	});
};

processor.process = function(inputs, outputs) {
	var config = this.config;
	var template = this.template;

	var output = outputs[0];
	var resource = _.find(config.resources, function(candidate) {
		return candidate.path === output.path;
	});
	var clazz = resource['class'];
	var url = 'http://' + config.host + '/tester/?raw=1&resourceClass=' + clazz;
	return httpGetJSON(url).then(function(data) {
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
