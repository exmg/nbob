'use strict';

var _ = require('lodash');
var childProcess = require('child_process');
var os = require('os');
var Promise = require('./promise');

var nrCores = os.cpus().length;
var nrRoleys = nrCores - 1;
var roleys = [];
var index = 0;
var jobs = {};

function init() {
	for (var i = 0; i < nrRoleys; i++) {
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
		});
	});
}

function process(processor, inputs, outputs) {
	if (roleys.length < nrRoleys) {
		init();
	}

	return new Promise(function(resolve, reject) {
		var jobId = index++;

		var job = {
			resolve: resolve,
			reject: reject,
			outputs: outputs.map(function(output) {
				return { resolve: output.resolve, reject: output.reject };
			})
		};
		jobs[jobId] = job;

		// TODO: Replace round robin by queued scheduling?
		var roley = roleys[jobId % nrRoleys];

		// TODO: Have roley forward log messages and then log them here using processor.log
		roley.send({
			job: jobId,
			processor: processor.name,
			config: processor.config,
			log: processor.log.prefix,
			inputs: inputs,
			outputs: outputs.map(function(output) {
				return _.omit(output, 'resolve', 'reject');
			})
		});
	});
}

function cleanup() {
	roleys.forEach(function(roley) {
		roley.send('exit');
	});
	roleys = [];
	jobs = {};
}

module.exports = {
	enabled: nrRoleys > 0,
	process: process,
	cleanup: cleanup
};
