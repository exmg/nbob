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
		roleys.push(childProcess.fork(__dirname + '/roley.js'));
	}

	roleys.forEach(function(roley) {
		roley.on('message', function(message) {
			var job = jobs[message.job];
			var log = job.log;
			var output = job.outputs[message.i];
			switch (message.type) {
				case 'log': log[message.level].apply(log, message.args); break;
				case 'output-resolve': output.resolve(message.data); break;
				case 'output-reject': output.reject(message.error); break;
				case 'resolve': job.resolve(message.data); break;
				case 'reject': job.reject(message.error); break;
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
			log: processor.log,
			resolve: resolve,
			reject: reject,
			outputs: outputs.map(function(output) {
				return { resolve: output.resolve, reject: output.reject };
			})
		};
		jobs[jobId] = job;

		// TODO: Replace round robin by queued scheduling?
		var roley = roleys[jobId % nrRoleys];

		roley.send({
			job: jobId,
			processor: processor.name,
			config: processor.config,
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