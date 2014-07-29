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
		output.reject = function(reason) {
			// Make Error JSON stringifyable
			reason = { message: reason.message, stack: reason.stack };
			process.send({ job: job, output: i, rejected: true, value: reason });
		};
	});

	Promise.resolve(processor.process(inputs, outputs)).then(function(data) {
		process.send({ job: job, value: data });
	}, function(reason) {
		process.send({ job: job, rejected: true, value: reason });
	});
});
