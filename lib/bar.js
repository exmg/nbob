/*jshint node:true, strict:false*/

// var _ = require('lodash');
var ProgressBar = require('progress');

var barFormat = '[:bar] :percent :etas (:names)';
var bar = new ProgressBar(barFormat, { total: 0, incomplete: ' ' });
var counterMap = {};

function isActive() {
	return bar.start ? true : false;
}

function render() {
	bar.render({ names: Object.keys(counterMap).join(', ') });
}

function add(name, nr) {
	nr = nr || 1;
	var counter = counterMap[name] || 0;
	counterMap[name] = counter + nr;
	bar.total += nr;
	// TODO: Cap bar width and format so it does not exceed terminal width
	bar.width = bar.total;
	if (!bar.start) {
		bar.start = new Date();
	}
	render();
}

function finish(name, nr) {
	nr = nr || 1;
	var count = counterMap[name] - nr;
	if (count) {
		counterMap[name] = count;
	} else {
		delete counterMap[name];
	}
	bar.curr += nr;
	render();
}

module.exports = {
	isActive: isActive,
	render: render,
	add: add,
	finish: finish
};
