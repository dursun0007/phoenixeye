var debug = require('debug')('server:routes:images');
var config = require('../includes/config.js');

var Promise = require('bluebird');

var path = require('path');

var router = require('express').Router();
var jsonParser = require('body-parser').json();

//upload related
var Busboy = require('busboy');
var fs = require('fs');

var request = require('request');

var HTTPError = require('node-http-error');

//model
var SubmittedFile = require('../models/SubmittedFile.js');

//handle image upload
router.post('/upload', function (req, res, next) {
	debug('/upload');

	//prepare busboy for upload
	var busboy = new Busboy({
		headers: req.headers,
		limits: {
			files: config.upload.maxFiles,
			fileSize: config.upload.sizeLimit
		}
	});

	//feed request to busboy
	req.pipe(busboy);

	//init image
	var uploadedImage = new SubmittedFile();
	uploadedImage.uploaderIP = req.ip || req.connection.remoteAddress;

	//to check if file limit is reached
	var fileLimitReached = false;

	//file handler
	busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
		debug('on file', fieldname, filename, encoding, mimetype);

		uploadedImage.file = file;
		uploadedImage.originalFileName = filename;

		//write upload to tmp folder
		var tmpFile = fs.createWriteStream(uploadedImage.tmpPath);
		file.pipe(tmpFile);
	});

	//file limit handler
	busboy.on('filesLimit', function () {
		debug('on file limit');
		uploadedImage.unlink();
		fileLimitReached = true;
	});

	//upload is done
	busboy.on('finish', function () {
		//make sure to avoid sending resp > once
		if( res.headersSent ) {
			return;
		}

		debug('on upload finish', res.headersSent);

		//cry if more than 1 file submitted
		if( fileLimitReached ) {
			return next(new HTTPError(400, 'only 1 file allowed'));
		}

		//cry if there was an error or file is too big
		if( ! uploadedImage.file ) {
			return next(new HTTPError(500, 'error while uploading the file'));
		} else if( uploadedImage.file.truncated ) {
			uploadedImage.unlink();
			return next(new HTTPError(413, 'file too big'));
		}

		debug('upload OK', uploadedImage);

		//go ahead with image submission
		uploadedImage.fileChecks(req.app.models.image)
		.then(function (image) {
			if( image.duplicate ) {
				return [image, {data: {_id: null}}];
			} else {
				return [image, image.queueAnalysis(config.defaultAnalysisOpts)];
			}
		})
		.spread(function (image, job) {
			return res.json({
				image: image,
				jobId: job.data._id
			});
		})
		.catch(function (err) {
			return next(err);
		});
	});
});

//submit url
router.post('/submit', jsonParser, function (req, res, next) {
	/*eslint no-unused-vars: 0*/

	debug('/submit');

	var imageUrl = req.body.url;

	if( ! imageUrl ) {
		return next(new HTTPError(400, 'url is required'));
	}

	// init image
	var downloadedImage = new SubmittedFile();
	downloadedImage.uploaderIP = req.ip || req.connection.remoteAddress;
	downloadedImage.url = imageUrl;

	//get preliminary info on url
	Promise.fromCallback(function (callback) {
		return request.head(imageUrl, callback);
	}, {multiArgs: true})
	.spread(function (response, body) {
		//too big
		if( response.headers['content-length'] > config.upload.sizeLimit) {
			throw new HTTPError(413, 'file too big');
		}

		var contentDisposition = response.headers['content-disposition'] || '';
		var originalFileName = contentDisposition.match(/filename="(.+)";/);
		if( originalFileName ) {
			downloadedImage.originalFileName = originalFileName[1];
		} else {
			downloadedImage.originalFileName = path.basename(imageUrl);
		}

		//download the image
		request.get(imageUrl)
		//pipe to tmp path
		.pipe(fs.createWriteStream(downloadedImage.tmpPath))
		//process submission when it's over
		.on('close', function () {
			downloadedImage.fileChecks(req.app.models.image)
			.then(function (image) {
				if( image.duplicate ) {
					return [image, {data: {_id: null}}];
				} else {
					return [image, image.queueAnalysis(config.defaultAnalysisOpts)];
				}
			})
			.spread(function (image, job) {
				return res.json({
					image: image,
					jobId: job.data._id
				});
			})
			.catch(function (err) {
				return next(err);
			});
		});
	})
	.catch(function (err) {
		return next(err);
	});
});

//get an image by its permalink
router.get('/:permalink', function (req, res, next) {
	debug('/:permalink');

	//try to get image by permalink
	req.app.models.image.findOne({
		permalink: req.params.permalink
	})
	.then(function (image) {
		//404
		if( ! image ) {
			throw new HTTPError(404, 'no image with this permalink');
		}

		//return image
		return res.json({
			image: image
		});
	})
	.catch(function (err) {
		return next(err);
	});
});

//submit an analysis request to the job queue for an image
router.post('/:permalink/analysis', jsonParser, function (req, res, next) {
	debug('/:permalink/analysis');

	//try to get image by permalink
	req.app.models.image.findOne({
		permalink: req.params.permalink
	})
	.then(function (image) {
		//404
		if( ! image ) {
			throw new HTTPError(404, 'no image with this permalink');
		}

		//get requesters ip just in case
		req.body.requesterIP = req.ip || req.connection.remoteAddress;

		//submit analysis request
		return image.queueAnalysis(req.body);
	})
	.then(function (job) {
		return res.json({
			jobId: job.data._id
		});
	})
	.catch(function (err) {
		return next(err);
	});
});

module.exports = router;
