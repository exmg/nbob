'use strict';

var path = require('path');
var fs2 = require('../fs2');
var Handlebars = require('../handlebars');
var promisify = require('../promisify');
var question = require('../question');
var mkdirp = promisify(require('mkdirp'));
var awsFn = 'credentials';
var homeDir = path.join(process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'], '.aws');
var homeFn = path.join(homeDir, awsFn);
var resFn = path.join(__dirname, '..', '..', 'res', 'init-aws', awsFn + '.hbs');

module.exports = function(config, log, inputFiles) {
	return fs2.readFile(homeFn).then(function() {
		log.debug('%s already exists', homeFn);
	}, function() {
		return question('AWS Access Key Id').then(function(id) {
			return question('AWS Secret Access Key').then(function(secret) {
				return fs2.readFile(resFn).then(function(buffer) {
					var template = Handlebars.compile(buffer.toString());
					var output = template({ id: id, secret: secret });
					return mkdirp(homeDir).then(function() {
						return fs2.writeFile(homeFn, output).then(function() {
							log.ok(homeFn);
						});
					});
				});
			});
		});
	}).then(function() {
		return inputFiles;
	});
};
