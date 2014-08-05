'use strict';

var AWS = require('aws-sdk');
var _ = require('lodash');
var mime = require('mime');
var pako = require('pako');
var md5hex = require('../md5hex');
var minimatches = require('../minimatches');
var Promise = require('../promise');
var promisify = require('../promisify');
var question = require('../question');

function bytes(nr) {
	return (nr / 1024).toFixed(1) + 'K';
}

function percentage(a, b) {
	return (b ? (a * 100 / b).toFixed(1) : '∞') + '%';
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

function getInputsPromise(inputFiles, gzipThreshold) {
	var inputPromises = inputFiles.map(function(file) {
		var path = file.path;

		var type = mime.lookup(path);
		var charset = mime.charsets.lookup(type);
		type = charset ? type + '; charset=' + charset : type;

		var input = { path: path, type: type };

		return file.getBuffer().then(function(buffer) {
			var compressible = /json|text|xml|javascript/.test(type);
			if (compressible && buffer.length > gzipThreshold) {
				// Note: not using Node's zlib module because it generates inconsistent output on OS X and Windows
				// That would result in different MD5's and needless reported changes and uploads
				var compressed = new Buffer(pako.gzip(buffer, { level: 9 }));
				return _.extend(input, {
					buffer: compressed,
					originalSize: buffer.length,
					encoding: 'gzip',
					md5: md5hex(compressed)
				});
			}

			return _.extend(input, {
				buffer: buffer,
				md5: md5hex(buffer)
			});
		});
	});
	return Promise.all(inputPromises);
}

function analyze(inputs, objects, keepPatterns, force) {
	var analysis = {
		added: [],
		changed: [],
		removed: [],
		kept: [],
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
		if (minimatches([ key ], keepPatterns).length) {
			analysis.kept.push(key);
		} else if (!_.find(inputs, { path: key })) {
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

	analysis.kept.forEach(function(key) {
		log.info('Kept: %s', key);
	});

	log.info('Files added: %d, changed: %d, removed: %d, kept: %d, unchanged: %d',
		analysis.added.length,
		analysis.changed.length,
		analysis.removed.length,
		analysis.kept.length,
		analysis.unchanged.length
	);
}

module.exports = function(config, log, inputFiles) {
	var region = config.region;
	var bucketName = config.bucketName;

	var s3 = myS3(region, bucketName);
	var cf = myCF();

	return Promise.apply([
		getDistsPromise(cf, bucketName),
		getInputsPromise(inputFiles, config.gzipThreshold),
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

		var analysis = analyze(inputs, objects, config.keep, config.force);

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
				var buffer = input.buffer;
				var encoding = input.encoding;
				var params = {
					ACL: 'public-read',
					Body: buffer,
					CacheControl: config.cacheControl,
					ContentType: input.type,
					Key: key
				};
				if (encoding) {
					params.ContentEncoding = encoding;
				}
				return s3.putObject(params).then(function() {
					var originalSize = input.originalSize;
					var outputSize = buffer.length;
					if (encoding) {
						log.ok('Copied: %s (%s %s %s of %s)', key,
							bytes(outputSize), encoding, percentage(outputSize, originalSize), bytes(originalSize)
						);
					} else {
						log.ok('Copied: %s (%s)', key, bytes(outputSize));
					}
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
