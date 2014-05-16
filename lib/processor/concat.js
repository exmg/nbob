/*jshint node:true, strict:false*/

var Promise = require('../promise');
var Processor = require('../processor');
var minimatches = require('../minimatches');
var File = require('../file');
var Batch = require('../batch');

var processor = new Processor();

processor.getBatches = function(inputPaths) {
	var config = this.config;
	inputPaths = minimatches(inputPaths, config.files);
	var outputPaths = [ config.project.name + '-' + config.project.version + '.js' ];
	return [ new Batch(inputPaths, outputPaths) ];
};

processor.process = function(batch, inputFileMap) {
	var outputPath = batch.outputPaths[0];
	var outputFile = new File(outputPath);

	var textPromise = Promise.all(batch.inputPaths.map(function(path) {
		return inputFileMap[path].getText();
	})).then(function(texts) {
		return texts.join('\n');
	});

	outputFile.setText(textPromise);

	return new Promise(function(resolve, reject) {
		textPromise.then(function() {
			var outputFileMap = {};
			outputFileMap[outputPath] = outputFile;
			resolve(outputFileMap);
		}, reject);

	});
};

module.exports = processor;
