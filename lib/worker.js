'use strict';

/*!
 * Module dependencies.
 */
var spawn = require('child_process').spawn;
var domain = require('domain');


/*
 * Exports
 */
module.exports = worker;
exports.Worker = Worker;


/**
 * The Worker! 
 * 
 * @param {Task} task A task object
 */
function Worker(task, ummon){
  var self = this;

  self.pid = null;
  self.task = task;

  self.log = ummon.log.child({worker: task.name});

  var d = domain.create();
  d.on('error', function(er) {
    console.error('WORKER DOMAIN ERROR', er.stack);
  });

  d.add(self);

  d.run(function() {
    self.log.info('worker.start');
    var running = spawn('sh', ['-c',task.command], { 
      cwd: '.', // BUG: this doesn't work with task.cwd...why?
      env: process.env
    });

    self.pid = running.pid;

    running.stdout.on('data', function (data) {
      self.log.info('stdout: ' + data.toString().trim());
    });

    running.stderr.on('data', function (data) {
      self.log.error(data.toString().trim());
    });

    running.on('close', function (code) {
      self.log.info("worker.complete with " + code);
      ummon.dispatcher.emit('worker.complete', code);
    });
  });
}


/**
 * A simple worker constructor helper
 *
 * Example:
 * 
 *     var worker = require('./worker');
 *     
 *     var aWorker = worker(task);
 */
function worker(task, dispatcher) {
  return new Worker(task, dispatcher);
}