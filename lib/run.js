'use strict';

/*!
 * Module dependencies.
 */
// var _ = require('underscore');
var uuid = require('uuid');


/*!
 * Exports
 */
module.exports = run;
exports.Run = Run;


/**
 * The Run constructor
 *
 * @param  {string} name   The name of the run
 * @param  {object} config Configuration options for the run
 */
function Run(task){
  this.id = uuid.v4();
  this.task = task;
  this.created = Date.now(); // The time when it was queued
  this.started = null;
  this.completed = null;
  this.exitCode = null;
}


/**
 * A simple constructor helper
 *
 * Example:
 * 
 *     var run = require('./run');
 *     
 *     var aRun = run({
 *       "name": "sleep5"
 *       "cwd": "/var/www/website2/",
 *       command": "sleep 5 && echo 'Run Finished'",
 *       "trigger": {
 *         "time": "*\/10 * * * *"
 *       }
 *     });
 *    
 * @param  {object} config Configuration options for the run
 */
function run(task){
  return new Run(task);
}


/**
 * Mark the run as started
 */
Run.prototype.start = function(){
  this.started  = Date.now();
};


/**
 * Mark the run as completed
 * 
 * @param  {Number} code the exit code from the worker
 */
Run.prototype.complete = function(code){
  this.completed  = Date.now();
  this.exitCode = code;
};


/**
 * How long has this task been running or did take to run in seconds?
 */
Run.prototype.duration = function(){
  var from = (this.completed) ? this.completed : Date.now();

  return from - this.started;
};