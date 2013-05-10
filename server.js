'use strict';


/**
 * Module dependencies.
 */
var restify = require('restify');
var bunyan = require('bunyan');
var ummon = require('./lib/ummon').create();

var api = require('./lib/api')(ummon);


var server = restify.createServer({
  version: 0,
  name: 'Ummon',
  log: bunyan.createLogger({
    name: 'API',
    stream: process.stdout
  })
});

// server.on('after', restify.auditLogger({
//   log: bunyan.createLogger({
//     name: 'audit',
//     stream: process.stdout
//   })
// }));

// Middlewarez
server.use(restify.acceptParser(server.acceptable));
server.use(restify.requestLogger());
server.use(restify.bodyParser());
server.use(restify.gzipResponse());


// The routes!
server.get('/ps/:pid', api.ps);
server.get('/ps', api.ps);
// server.post('/kill/:pid', api.kill);
server.get('/status', api.status);
server.post('/tasks/new', api.createTask);
server.get('/tasks/:taskid', api.showTask);
server.put('/tasks/:taskid', api.updateTask);
server.del('/tasks/:taskid', api.deleteTask);
server.get('/tasks', api.showTasks);
server.get('/collection/:collection', api.showTasks);
// server.post('/run/:taskid', api.run);
// server.post('/run', api.run);
// server.get('/log/:collection', api.showLog);
// server.get('/log/:taskid', api.showLog);
// server.get('/log/:jobid', api.showLog);
// server.get('/log', api.showLog);
// server.get('/tail/:collection', api.streamLog);
// server.get('/tail/:taskid', api.streamLog);
// server.get('/tail/:jobit', api.streamLog);
// server.get('/tail', api.streamLog);


server.listen(ummon.config.port, function() {
  console.log("               _  __              _       _ ");
  console.log("              | |/ __      ____ _| |_ ___| |");
  console.log("              | ' /\\ \\ /\\ / / _` | __|_  | |");
  console.log("              | . \\ \\ V  V | (_| | |_ / /|_|");
  console.log("              |_|\\_\\ \\_/\\_/ \\__,_|\\__/___(_)");
  console.log("");
  server.log.info({addr: server.address()}, 'listening');
});