'use strict';

/*!
 * Module dependencies.
 */
var spawn = require('child_process').spawn;
var domain = require('domain');
var path = require('path');
var fs = require('fs');


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

  // Setup some defaults
  self.pid = null;
  self.run = run;

  // Setup log child
  var logOptions = {runid: run.id};
  if (run.task.id) { logOptions.taskid = run.task.id; }
  if (run.task.collection) { logOptions.collection = run.task.collection; }
  self.log = ummon.log.child(logOptions);

  // Setup the domain
  var d = domain.create();
  d.on('error', function(er) {
    self.log.error(er, 'WORKER DOMAIN ERROR');
  });

  d.run(function() {
    self.log.info('worker.start');
    run.start();

    run.task.cwd = (run.task.cwd) ? path.resolve(run.task.cwd) : '.';

    var stats = fs.statSync(run.task.cwd);

    // If the cwd is a real directory...
    if (!stats.isDirectory()) {
      self.log.err('CWD provided for %s does not exist', run.task.id);
    } else {
      ummon.dispatcher.emit('worker.start', run);
      
      var running = spawn('sh', ['-c',run.task.command], { 
        cwd: run.task.cwd,
        env: process.env
      });

      self.pid = running.pid; // Set the worker.pid
      run.pid = running.pid; // Give it to the run as well!
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
    }

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