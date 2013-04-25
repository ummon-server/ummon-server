'use strict';

/**
 * Module dependencies.
 */
var _ = require('underscore');

module.exports = task;
exports.Task = Task;

function task (name, config) {
  return new Task(name, config);
}

var Task = function(name, config){
  if (!name || !config) {
    throw new Error('You must provide a task name and config object');
  }

  if (_.size(config.trigger) === 0) {
    throw new Error('A task must have at least one trigger');
  }

  this.name = name;
  this.cwd = config.cwd || null;
  this.command = config.command || null;
  this.arguments = config.arguments || null;
  this.trigger = {
    time: config.trigger.time || null,
    before: config.trigger.before || null,
    after: config.trigger.after || null,
    afterSuccess: config.trigger.afterSuccess || null,
    afterFail: config.trigger.afterFail || null,
  };
};