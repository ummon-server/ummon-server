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
function Task(config){
  if (!config) { throw new Error('You must provide a config object'); }
  if (!config.name) { throw new Error('A task must provide a task name!'); }
  if (!config.collection) { throw new Error('A task must provide a collection!'); }
  if (_.size(config.trigger) === 0) { throw new Error('A task must have at least one trigger'); }

  this.name = config.name;
  this.collection = config.collection;

  this.id = this.collection + '.' + this.name;

  this.cwd = config.cwd || null;
  this.command = config.command || null;
  this.arguments = config.arguments || null;
  this.trigger = {
    time: config.trigger.time || null,
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
 *     var aTask = task({
 *       "name": "sleep5"
 *       "cwd": "/var/www/website2/",
 *       command": "sleep 5 && echo 'Task Finished'",
 *       "trigger": {
 *         "time": "*\/10 * * * *"
 *       }
 *     });
 *    
 * @param  {string} name   The name of the task
 * @param  {object} config Configuration options for the task
 */
function task(config){
  return new Task(config);
}