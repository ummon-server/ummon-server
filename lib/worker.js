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
function Worker(run, ummon){
  var self = this;

  self.pid = null;
  self.run = run;

  var logOptions = {runid: run.id};
  if (run.task.id) { logOptions.taskid = run.task.id; }
  if (run.task.collection) { logOptions.collection = run.task.collection; }
  self.log = ummon.log.child(logOptions);

  var d = domain.create();
  d.on('error', function(er) {
    console.error('WORKER DOMAIN ERROR', er.stack);
  });

  d.add(self);

  d.run(function() {
    self.log.info('worker.start');
    run.start();
    var running = spawn('sh', ['-c',run.task.command], { 
      cwd: '.', // BUG: this doesn't work with task.cwd...why?
      env: process.env
    });

    self.pid = running.pid;
    self.run = run;
    self.worker = running;

    running.stdout.on('data', function (data) {
      self.log.debug('stdout: ' + data.toString().trim());
    });

    running.stderr.on('data', function (data) {
      self.log.error(data.toString().trim());
    });

    running.on('close', function (code) {
      run.complete(code);
      self.log.info("worker.complete in %s seconds with exit code %s", run.duration()/1000, code);
      ummon.dispatcher.emit('worker.complete', run);
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