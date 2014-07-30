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
var waiting = [];

function init() {
	for (var i = 0; i < nrRoleys; i++) {
		roleys.push(childProcess.fork(__dirname + '/roley.js'));
	}

	roleys.forEach(function(roley) {
		roley.on('message', function(message) {
			var job = jobs[message.job];
			var log = job.log;
			var output = job.outputs[message.i];
			var type = message.type;
			switch (type) {
				case 'log': log[message.level].apply(log, message.args); break;
				case 'output-resolve': output.resolve(message.data); break;
				case 'output-reject': output.reject(message.error); break;
				case 'resolve': job.resolve(message.data); break;
				case 'reject': job.reject(message.error); break;
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
				inputs: inputs,
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
