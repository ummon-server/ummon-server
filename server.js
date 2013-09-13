#!/usr/bin/env node

'use strict';

/**
 * Module dependencies.
 */
var optimist = require('optimist');
var domain = require('domain');
var npid = require('npid');
var path = require('path');
var restify = require('restify');
var socketio = require('socket.io');
var bunyan = require('bunyan');
var _ = require('underscore');
var ON_DEATH = require('death')({uncaughtException: true});


var argv = optimist.usage('Ummon and stuff', {
  'config': {
    description: 'The path to your ummon config.json file',
    string: true,
    alias: 'c',
  },
  'daemon': {
    description: 'Daemonize the ummon server process',
    boolean: true,
    alias: 'd',
  },
  'pidfile': {
    'default': 'ummon.pid',
    description: 'Set a custom pid file location',
    string: true,
    alias: 'p',
  }
}).argv;

// Daemonize if asked
if (argv.daemon) require('daemon')();

// Create the pid file, throwing on failure
npid.create(argv.pidfile);

// It's possible to pass a string that will be the config path. Catch it here:
var ummonOptions = (argv.config)
      ? {configPath: argv.config}
      : {};

var ummon = require('./lib/ummon')(ummonOptions);


/**
 * Watch for and properly respond to signals
 */

ON_DEATH(function(signal, err) {
  if (!ummon.pause) {
    ummon.pause = true;

    ummon.log.info("Kill (%s) signal received. Waiting for workers to finish", signal);

    _.each(ummon.workers, function(run){
      run.worker.kill(signal);
    })

    setInterval(function(){
      var count = _.size(ummon.workers);

      if (0 === count) {
        ummon.log.info("All workers complete. Exiting");
        process.exit(0);
      }
      ummon.log.info("Still waiting for %s workers to finish", count);
    }, 250)
  }
});

// Don't explode if your're piping and it stops
process.stdout.on('error', function( err ) {
  if (err.code == "EPIPE") {
    process.exit(0);
  }
});


/**
 * Create Restify Server
 */

var server = restify.createServer({
  version: 0,
  name: 'Ummon',
  log: ummon.log
});

server.on('after', function(req, res, route, error) {
  if (route) {
    ummon.log.info({apiUrl:req.url},'%s - %s (matched by route %s)', res.statusCode, req.url, route.spec.path);
  } else {
    ummon.log.info({apiUrl:req.url}, '%s - %s', res.statusCode, req.url);
  }
});

// Middlewarez
server.use(restify.acceptParser(server.acceptable));
server.use(restify.requestLogger());
server.use(restify.bodyParser());
server.use(restify.queryParser());
server.use(restify.gzipResponse());
server.use(restify.CORS({
        origins: ['localhost', 'localhost:8888', 'localhost:3000'],   // defaults to ['*']
        // credentials: true                  // defaults to false
        // headers: ['x-foo']                 // sets expose-headers
    }));
server.use(restify.authorizationParser());

server.pre(restify.pre.sanitizePath());
server.use(restify.fullResponse());

server.use(function (req, res, next){
  if (ummon.config.credentials.indexOf(req.authorization.credentials) !== -1){
    next();
  } else {
    res.json(401, "Log in dummy. KWATZ!")
  }
})

// Set up the api
var api = require('./api')(ummon);

// The routes!
server.get('/ps/:pid', api.ps);
server.get('/ps', api.ps);
// server.post('/kill/:pid', api.kill);
server.get('/status', api.getStatus);
server.get('/config', api.getConfig);
server.put('/config', api.setConfig);

server.get('/queue', api.getQueue);
server.post('/queue/clear', api.clearQueue);

server.post('/tasks/new', api.createTask);
server.get('/tasks/:taskid', api.getTasks);
server.put('/tasks/:taskid', api.doesTaskExist, api.updateTask);
server.del('/tasks/:taskid', api.doesTaskExist, api.deleteTask);
server.put('/tasks/:taskid/enable', api.doesTaskExist, api.enableTask);
server.put('/tasks/:taskid/disable', api.doesTaskExist, api.disableTask);
server.get('/tasks', api.getTasks);

server.get('/collections/:collection', api.doesCollectionExist, api.getTasks);
server.put('/collections/:collection', api.setTasks);
server.get('/collections/:collection/defaults', api.doesCollectionExist, api.getCollectionDefaults);
server.put('/collections/:collection/defaults', api.setCollectionDefaults);
server.put('/collections/:collection/enable', api.doesCollectionExist, api.enableCollection);
server.put('/collections/:collection/disable', api.doesCollectionExist, api.disableCollection);
server.del('/collections/:collection', api.doesCollectionExist, api.deleteCollection);
// server.post('/run/:taskid', api.run);
// server.post('/run', api.run);
server.get('/log', api.showLog);


var getRuns = _.throttle(function(){ return ummon.getRuns(); }, '500');

var d = domain.create();

d.on('error', function(err) {
  if (err.code === 'EADDRINUSE') {
    server.log.error(err, 'The address you\'re trying to bind to is already in use');
  } else {
    server.log.error('ERROR',err);
  }

  process.exit(1);
})

d.run(function(){
  server.listen(ummon.config.port, function() {
    console.log("               _  __              _       _ ");
    console.log("              | |/ __      ____ _| |_ ___| |");
    console.log("              | ' /\\ \\ /\\ / / _` | __|_  | |");
    console.log("              | . \\ \\ V  V | (_| | |_ / /|_|");
    console.log("              |_|\\_\\ \\_/\\_/ \\__,_|\\__/___(_)");
    console.log("");
    server.log.info({addr: server.address()}, 'listening');

    var io = socketio.listen(server);
    io.on('error', function(test){
      console.log('ERRROROROROR', test)
    })
    io.set('log level', 1);
    io.sockets.on('connection', function (socket) {
        socket.emit('send:tasks', ummon.getTasks());

        // Send runs
        // TODO: Is there a way to bind to multiple events with one listener?
        ummon.on('worker.start', function(){ socket.emit('send:runs', getRuns()); });
        ummon.on('worker.complete', function(){ socket.emit('send:runs', getRuns()); });
        ummon.on('queue.new', function(){ socket.emit('send:runs', getRuns()); });
    });
  });
})
