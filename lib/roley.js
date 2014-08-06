'use strict';

var _ = require('lodash');
var getProcessor = require('./get-processor');
var Promise = require('./promise');

process.on('message', function(message) {
	if (message === 'exit') {
		process.exit();
	}

	var job = message.job;
	var inputs = message.inputs;
	var outputs = message.outputs;

	var log = {};
	[ 'spam', 'debug', 'info', 'ok', 'warn', 'error', 'silent' ].forEach(function(level) {
		log[level] = function() {
			process.send({ job: job, type: 'log', level: level, args: _.toArray(arguments) });
		};
	});

	var processor = getProcessor(message.processor, message.config, log);

	outputs.forEach(function(output, i) {
		output.resolve = function(data) {
			process.send({ job: job, type: 'output-resolve', i: i, data: data });
		};
		output.reject = function(error) {
			// Make Error JSON stringifyable
			error = { name: error.name, message: error.message, stack: error.stack };
			process.send({ job: job, type: 'output-reject', i: i, error: error });
		};
	});

	var promise = new Promise(function(resolve) {
		resolve(processor.process(inputs, outputs));
	});

	promise.then(function(data) {
		process.send({ job: job, type: 'resolve', data: data });
	}, function(error) {
		// Make Error JSON stringifyable
		error = { name: error.name, message: error.message, stack: error.stack };
		process.send({ job: job, type: 'reject', error: error });
	});
});
