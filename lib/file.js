/*jshint node:true, strict:false*/

var fs = require('fs');
var promisify = require('./promisify');
var readFile = promisify(fs.readFile);

function File(path) {
	this.path = path;
}

var proto = File.prototype;

proto.read = function(encoding) {
	return readFile(this.path, { encoding: encoding });
};

module.exports = File;
