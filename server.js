'use strict';


/**
 * Module dependencies.
 */
var restify = require('restify');
var ummon = require('./lib/ummon').create();

var api = require('./lib/api')(ummon);


var server = restify.createServer({
  log: ummon.log,
  version: 0,
  name: 'Ummon',
});


// Middlewarez
server.use(restify.acceptParser(server.acceptable));
server.use(restify.requestLogger());
server.use(restify.bodyParser());
server.use(restify.gzipResponse());


// The routes!
server.get('/ps', api.ps);
server.get('/status', api.status);
server.post('/createTask', api.createTask);
server.get('/:taskid', api.showTask);
server.put('/:taskid', api.updateTask);
server.del('/:taskid', api.deleteTask);


server.listen(ummon.config.port, function() {
  console.log("               _  __              _       _ ");
  console.log("              | |/ __      ____ _| |_ ___| |");
  console.log("              | ' /\\ \\ /\\ / / _` | __|_  | |");
  console.log("              | . \\ \\ V  V | (_| | |_ / /|_|");
  console.log("              |_|\\_\\ \\_/\\_/ \\__,_|\\__/___(_)");
  console.log("");
  server.log.info({addr: server.address()}, 'listening');
});