'use strict';

var _ = require('lodash');
var childProcess = require('child_process');
var os = require('os');
var Promise = require('./promise');
var log = require('./logger').create('scoop');

var nrCores = os.cpus().length;
var nrRoleys = nrCores - 1;
var roleys = [];
var index = 0;
var jobs = {};
var waiting = [];

function init() {
	for (var i = 0; i < nrRoleys; i++) {
		roleys.push(childProcess.fork(__dirname + '/roley.js'));
	}

	roleys.forEach(function(roley) {
		roley.on('message', function(message) {
			/*jshint maxcomplexity:10*/
			var job = jobs[message.job];
			if (!job) {
				// Sometimes messages are still received after cleanup() is called
				log.debug('Job with id %d not found in ids: %s', message.job, Object.keys(jobs).join(', '));
				return;
			}
			var jobLog = job.log;
			var output = job.outputs[message.i];
			var type = message.type;
			var error = message.error && _.extend(new Error(), message.error);
			var data = message.data;
			switch (type) {
				case 'log': jobLog[message.level].apply(jobLog, message.args); break;
				case 'output-resolve': output.resolve(data.isBuffer ? new Buffer(data.array) : data); break;
				case 'output-reject': output.reject(error); break;
				case 'resolve': job.resolve(data); break;
				case 'reject': job.reject(error); break;
			}

			if (type !== 'log' && ++job.nrFinished === job.nrToFinish) {
				if (waiting.length > 0) {
					waiting.shift()(roley);
				} else {
					roley.busy = false;
				}
			}
		});
	});
}

function getRoley() {
	if (roleys.length < nrRoleys) {
		init();
	}

	return new Promise(function(resolve) {
		var i, roley;
		for (i = 0; i < nrRoleys; i++) {
			roley = roleys[i];
			if (!roley.busy) {
				roley.busy = true;
				resolve(roley);
				return;
			}
		}

		waiting.push(resolve);
	});
}

function process(processor, inputs, outputs) {
	return getRoley().then(function(roley) {
		return new Promise(function(resolve, reject) {
			var jobId = index++;

			var job = {
				log: processor.log,
				resolve: resolve,
				reject: reject,
				outputs: outputs.map(function(output) {
					return { resolve: output.resolve, reject: output.reject };
				}),
				nrFinished: 0,
				nrToFinish: outputs.length + 1
			};
			jobs[jobId] = job;

			roley.send({
				job: jobId,
				processor: processor.name,
				config: processor.config,
				inputs: inputs.map(function(input) {
					if (input.data instanceof Buffer) {
						input.data = { array: input.data.toJSON(), isBuffer: true };
					}
					return input;
				}),
				outputs: outputs.map(function(output) {
					return _.omit(output, 'resolve', 'reject');
				})
			});
		});
	});
}

function cleanup() {
	roleys.forEach(function(roley) {
		roley.send('exit');
	});
	roleys = [];
	jobs = {};
	waiting = [];
}

module.exports = {
	enabled: nrRoleys > 0,
	process: process,
	cleanup: cleanup
};
