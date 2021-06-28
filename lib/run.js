'use strict';

/*!
 * Module dependencies.
 */
var _ = require('underscore');
var uuid = require('uuid');
var moment = require('moment');


/*!
 * Exports
 */
module.exports = run;
exports.Run = Run;


/**
 * The Run constructor
 *
 * @param  {object} task
 * @param  {object} trigger
 */
function Run(task, trigger) {
  var self = this;
  this.id = uuid.v4();
  this.created = Date.now(); // The time when it was queued
  this.started = null;
  this.completed = null;
  this.exitCode = null;
  this.triggeredBy = trigger || 'manual';

  if (task.command.indexOf('<%') !== -1) {
    // Clone the task so we don't change the original
    task = JSON.parse(JSON.stringify(task));
    task.command = _.template(task.command)({run: self});
  }

  this.task = task;
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
 * @param  {object} task Configuration options for the run
 * @param  {object} trigger   what triggered the run
 */
function run(task, trigger) {
  return new Run(task, trigger);
}


/**
 * Mark the run as started
 */
Run.prototype.start = function () {
  this.started = Date.now();
};


/**
 * Mark the run as completed
 *
 * @param  {Number} code the exit code from the worker
 */
Run.prototype.complete = function (code) {
  this.completed = Date.now();
  this.exitCode = code;
};


/**
 * How long has this task been running or did take to run in seconds?
 */
Run.prototype.duration = function () {
  var from = (this.completed) ? this.completed : Date.now();

  return from - this.started;
};


/**
 * How long has this task been running or did take to run in seconds?
 */
Run.prototype.durationHuman = function () {
  var duration = this.duration();

  return moment.duration(duration / 1000, 'seconds').humanize();
};

