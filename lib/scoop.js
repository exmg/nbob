'use strict';

var _ = require('lodash');
var childProcess = require('child_process');
var os = require('os');
var Promise = require('./promise');

var numCPUs = os.cpus().length;
var roleys = [];
var index = 0;
var jobs = {};

for (var i = 0; i < numCPUs; i++) {
	// TODO: Pass on log level and any other necessary options to children
	roleys.push(childProcess.fork(__dirname + '/roley.js'));
}

roleys.forEach(function(roley) {
	roley.on('message', function(message) {
		var job = jobs[message.job];
		var output = message.output;
		var rejected = message.rejected;
		var value = message.value;

		if (output !== undefined) {
			output = job.outputs[output];
			if (rejected) {
				output.reject(value);
			} else {
				output.resolve(value);
			}
		} else if (rejected) {
			job.reject(value);
		} else {
			job.resolve(value);
		}

		// TODO: Cleanup job after it is finished
	});
});

function send(pName, pConfig, logName, inputs, outputs) {
	return new Promise(function(resolve, reject) {
		var jobId = index++;

		// TODO: Replace round robin by queued scheduling?
		var roley = roleys[jobId % roleys.length];

		var job = {
			resolve: resolve,
			reject: reject,
			outputs: outputs.map(function(output) {
				return { resolve: output.resolve, reject: output.reject };
			})
		};
		jobs[jobId] = job;

		roley.send({
			job: jobId,
			processor: pName,
			config: pConfig,
			log: logName,
			inputs: inputs,
			outputs: outputs.map(function(output) {
				return _.omit(output, 'resolve', 'reject');
			})
		});
	});
}

function exit() {
	roleys.forEach(function(roley) {
		roley.send('exit');
	});
}

module.exports = {
	send: send,
	exit: exit
};
