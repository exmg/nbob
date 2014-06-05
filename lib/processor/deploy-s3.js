'use strict';

var readline = require('readline');
var AWS = require('aws-sdk');
var _ = require('lodash');
var Promise = require('../promise');
var promisify = require('../promisify');

function question(text) {
	return new Promise(function(resolve) {
		var rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		rl.question(text + ' ', function(answer) {
			rl.close();
			resolve(answer);
		});
	});
}

function awsPromisifyListFn(fn, thisArg, key) {
	var promisified = promisify(fn, thisArg);
	return function() {
		return promisified.apply(thisArg, arguments).then(function(data) {
			if (data.IsTruncated) {
				throw new Error('Truncated results are not yet supported');
			}
			return data[key];
		});
	};
}

function myCF() {
	var cf = new AWS.CloudFront();
	return {
		listDistributions: awsPromisifyListFn(cf.listDistributions, cf, 'Items'),
		listInvalidations: awsPromisifyListFn(cf.listInvalidations, cf, 'Items'),
		createInvalidation: promisify(cf.createInvalidation, cf)
	};
}

function getDistsPromise(cf, bucketName) {
	return cf.listDistributions().then(function(dists) {
		var distPromises = dists.filter(function(dist) {
			return dist.Origins.Items.some(function(origin) {
				return origin.DomainName === bucketName + '.s3.amazonaws.com';
			});
		}).map(function(dist) {
			return cf.listInvalidations({ DistributionId: dist.Id }).then(function(invalidations) {
				dist.invalidationStats = invalidations.reduce(function(stats, invalidation) {
					stats[invalidation.Status] = (stats[invalidation.Status] || 0) + 1;
					return stats;
				}, { InProgress: 0, Completed: 0, Total: invalidations.length });
				return dist;
			});
		});
		return Promise.all(distPromises);
	});
}

function myS3(region, bucketName) {
	var s3 = new AWS.S3({
		region: region,
		params: { Bucket: bucketName }
	});
	return {
		listObjects: awsPromisifyListFn(s3.listObjects, s3, 'Contents'),
		putObject: promisify(s3.putObject, s3),
		deleteObject: promisify(s3.deleteObject, s3)
	};
}

function getInputsPromise(inputFiles) {
	var inputPromises = inputFiles.map(function(file) {
		var input = { path: file.path };
		return file.getBuffer().then(function(buffer) {
			input.buffer = buffer;
			// TODO: gzip
			return file.getMD5().then(function(md5) {
				input.md5 = md5;
				return input;
			});
		});
	});
	return Promise.all(inputPromises);
}

function analyze(inputs, objects, force) {
	var analysis = {
		added: [],
		changed: [],
		removed: [],
		unchanged: []
	};

	inputs.forEach(function(input) {
		var key = input.path;
		var obj = _.find(objects, { Key: key });
		if (!obj) {
			analysis.added.push(key);
		} else if (force || input.md5 !== obj.ETag.replace(/"/g, '')) {
			analysis.changed.push(key);
		} else {
			analysis.unchanged.push(key);
		}
	});

	objects.forEach(function(obj) {
		var key = obj.Key;
		if (!_.find(inputs, { path: key })) {
			analysis.removed.push(key);
		}
	});

	return analysis;
}

function showAnalysis(log, analysis) {
	analysis.added.forEach(function(key) {
		log.info('Added: %s', key);
	});

	analysis.changed.forEach(function(key) {
		log.info('Changed: %s', key);
	});

	analysis.removed.forEach(function(key) {
		log.info('Removed: %s', key);
	});

	log.info('Files added: %d, changed: %d, removed: %d, unchanged: %d',
		analysis.added.length, analysis.changed.length, analysis.removed.length, analysis.unchanged.length);
}

function getContentType(key) {
	// TODO: Replace by a better (third party) alternative
	var ext = key.substr(key.lastIndexOf('.') + 1);
	var typeMap = {
		css: 'text/css',
		eot: 'application/vnd.ms-fontobject',
		html: 'text/html',
		jpg: 'image/jpg',
		md: 'text/markdown',
		png: 'image/png',
		ttf: 'font/ttf',
		woff: 'application/font-woff'
	};
	return typeMap[ext];
}

module.exports = function(config, log, inputFiles) {
	var region = config.region;
	var bucketName = config.bucketName;

	var s3 = myS3(region, bucketName);
	var cf = myCF();

	return Promise.apply([
		getDistsPromise(cf, bucketName),
		getInputsPromise(inputFiles),
		s3.listObjects()
	], function(dists, inputs, objects) {
		log.info('[[ %s ]]', bucketName.toUpperCase());
		log.info('S3 URL: http://%s.s3-website-%s.amazonaws.com', bucketName, region);

		dists.forEach(function(dist) {
			log.info('CF URL: http://%s', dist.DomainName);
			dist.Aliases.Items.forEach(function(alias) {
				log.info('CF Alias: http://%s', alias);
			});
			var invalidationStats = dist.invalidationStats;
			log.info('CF Invalidations: InProgress: %d, Completed: %d, Total: %d',
				invalidationStats.InProgress, invalidationStats.Completed, invalidationStats.Total);
		});

		if (dists.length === 0) {
			log.info('No CloudFront distributions found using this bucket as origin.');
		}

		var analysis = analyze(inputs, objects, config.force);

		showAnalysis(log, analysis);

		var nrMutations = analysis.added.length + analysis.changed.length + analysis.removed.length;
		if (nrMutations === 0) {
			log.info('Nothing to do.');
			return;
		}

		return question('Synchronize to S3? (y/n)').then(function(answer) {
			if (answer !== 'y') {
				log.info('Aborting...');
				return;
			}

			var putPromises = analysis.added.concat(analysis.changed).map(function(key) {
				var input = _.find(inputs, { path: key });
				return s3.putObject({
					ACL: 'public-read',
					Body: input.buffer,
					CacheControl: config.cacheControl,
					// TODO: ContentEncoding: 'gzip',
					ContentType: getContentType(key, config.contentTypes),
					Key: key
				}).then(function() {
					log.ok('Copied: %s', key);
				});
			});

			var deletePromises = analysis.removed.map(function(key) {
				return s3.deleteObject({ Key: key }).then(function() {
					log.ok('Removed: %s', key);
				});
			});

			return Promise.all(putPromises.concat(deletePromises)).then(function() {
				var changedKeys = analysis.changed;

				if (changedKeys.length === 0) {
					log.info('Nothing to invalidate.');
					return;
				}

				if (dists.length === 0) {
					log.info('Nowhere to invalidate.');
					return;
				}

				return question('Invalidate on CloudFront? (y/n)').then(function(answer) {
					if (answer !== 'y') {
						log.info('Aborting...');
						return;
					}

					var invalidationPromises = dists.map(function(dist) {
						return cf.createInvalidation({
							DistributionId: dist.Id,
							InvalidationBatch: {
								CallerReference: '' + new Date(),
								Paths: {
									Quantity: changedKeys.length,
									Items: changedKeys.map(function(key) {
										return '/' + key;
									})
								}
							}
						}).then(function() {
							log.ok('Invalidated: %s', dist.Aliases.Items.join(', '));
						});
					});

					return Promise.all(invalidationPromises);
				});
			});
		});
	}).then(function() {
		// We did not modify input files
		return inputFiles;
	});
};
