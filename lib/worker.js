'use strict';

/*!
 * Module dependencies.
 */
var util = require("util");
var events = require("events");
var spawn = require('child_process').spawn;
var domain = require('domain');
// var _ = require("underscore");


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
function Worker(task){
  var self = this;
  events.EventEmitter.call(this);

  self.pid = null;

  var d = domain.create();
  d.on('error', function(er) {
    console.error('WORKER DOMAIN ERROR', er.stack);
  });

  d.add(self);

  d.run(function() {
    var running = spawn('sh', ['-c',task.command], { 
      cwd: '.', // BUG: this doesn't work with task.cwd...why?
      env: process.env
    });

    self.pid = running.pid;

    running.stdout.on('data', function (data) {
      console.log('stdout: ' + data);
    });

    running.stderr.on('data', function (data) {
      console.log('stderr: ' + data);
    });

    running.on('close', function (code) {
      console.log('child process exited with code ' + code);
      self.emit('complete', code);
    });
  });
}

util.inherits(Worker, events.EventEmitter);


/**
 * A simple worker constructor helper
 *
 * Example:
 * 
 *     var worker = require('./worker');
 *     
 *     var aWorker = worker(task);
 */
function worker(task) {
  return new Worker(task);
}