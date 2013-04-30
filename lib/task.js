'use strict';

/*!
 * Module dependencies.
 */
var _ = require('underscore');


/**
 * Exports
 */
module.exports = task;
exports.Task = Task;


/**
 * The Task constructor
 *
 * @param  {string} name   The name of the task
 * @param  {object} config Configuration options for the task
 */
function Task(name, config){
  if (!name || !config) {
    throw new Error('You must provide a task name and config object');
  }

  if (_.size(config.trigger) === 0) {
    throw new Error('A task must have at least one trigger');
  }

  this.name = name;
  this.collection = config.collection || null;
  this.cwd = config.cwd || null;
  this.command = config.command || null;
  this.arguments = config.arguments || null;
  this.trigger = {
    time: config.trigger.time || null,
    before: config.trigger.before || null,
    after: config.trigger.after || null,
    afterFail: config.trigger.afterFail || null,
  };
}


/**
 * A simple constructor helper
 *
 * Example:
 * 
 *     var task = require('./task');
 *     
 *     var aTask = task('sleep5', {
 *        "cwd": "/var/www/website2/",
 *        "command": "sleep 5 && echo 'Task Finished'",
 *        "arguments": ["--verbose", "--env=staging"],
 *        "trigger": {
 *          "time": "*\/10 * * * *"
 *        }
 *     });
 *    
 * @param  {string} name   The name of the task
 * @param  {object} config Configuration options for the task
 */
function task(name, config){
  return new Task(name, config);
}