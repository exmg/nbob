'use strict';

var getProcessor = require('./get-processor');
var Promise = require('./promise');

process.on('message', function(message) {
	if (message === 'exit') {
		process.exit();
	}

	var processor = getProcessor(message.processor, message.config, message.log);

	var job = message.job;
	var inputs = message.inputs;
	var outputs = message.outputs;

	outputs.forEach(function(output, i) {
		output.resolve = function(data) {
			process.send({ job: job, output: i, value: data });
		};
		output.reject = function(error) {
			// Make Error JSON stringifyable
			error = { message: error.message, stack: error.stack };
			process.send({ job: job, output: i, rejected: true, value: error });
		};
	});

	var promise = new Promise(function(resolve) {
		resolve(processor.process(inputs, outputs));
	});

	promise.then(function(data) {
		process.send({ job: job, value: data });
	}, function(error) {
		// Make Error JSON stringifyable
		error = { message: error.message, stack: error.stack };
		process.send({ job: job, rejected: true, value: error });
	});
});
