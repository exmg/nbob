/*jshint node:true, strict:false*/

var Promise = require('./promise');

function Schedule() {
	this.parallel = [];
	this.sequential = [];
}

var proto = Schedule.prototype;


proto.addParallel = function(task) {
	this.parallel.push(task);
};

proto.flushParallel = function() {
	var parallel = this.parallel;
	if (parallel.length > 0) {
		this.sequential.push(parallel);
		this.parallel = [];
	}
};

proto.addSequential = function(task) {
	this.flushParallel();
	this.sequential.push([ task ]);
};

proto.run = function() {
	this.flushParallel();
	return this.sequential.reduce(function(prevPromise, parallel) {
		return prevPromise.then(function() {
			return Promise.all(parallel.map(function(task) {
				return task();
			}));
		});
	}, Promise.resolve());
};

module.exports = Schedule;
