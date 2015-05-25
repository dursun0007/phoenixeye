var debug = require('debug')('server:main');
var config = require('./config.json');

var path = require('path');

var express = require('express');
var compression = require('compression');

var appRoot = require('app-root-path');

//connect to mongo
var mongoose = require('mongoose');
mongoose.connect(config.dbString);
mongoose.connection.on('error', function mongoError(err) {
	debug('Cannot connect to mongo', err);
});
mongoose.connection.once('open', function mongooseOpen() {
	debug('Connected to mongo');
});

//init app
var app = express();
app.enable('trust proxy');
app.disable('x-powered-by');
app.use(compression({
	threshold: 0
}));

//return api uptime
app.get('/api', function(req, res) {
	res.json({
		status: 'running',
		uptime: process.uptime()
	});
});

//routes
app.use('/api/images', require('./routes/images.js'));
app.use('/api/analyses', require('./routes/analyses.js'));
app.use('/api/jobs', require('./routes/jobs.js'));

//static files
app.use('/images', express.static(path.join(appRoot.toString(), 'images'), {index: 'false'}));
app.use(express.static(path.join(appRoot.toString(), 'client')));

//redirect anything else to index.html
app.use('/*', function indexRedirect(req, res, next) {
	res.sendFile(path.join(appRoot.toString(), 'client', 'index.html'));
});

//error handler
app.use(function errorHandler(err, req, res, next) {
	var status = 500;
	if( err.status ) status = err.status;
	res.status(status).json({error: err.message});
});

//init
app.listen(config.port, function () {
	debug('server running on port ' + config.port);
});

//export server for testing
module.exports.server = app;