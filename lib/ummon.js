'use strict';

/**
 * Module dependencies.
 */

var //fs = require('fs'),
    //path = require('path'),
    // _ = require('underscore'),
    //moment = require('moment'),
    winston = require('winston');

module.exports = ummon;

// Expose the constructor for potential inheritance
ummon.Ummon = Ummon;
// Can decide on the api here
function ummon (options) {
  return new Ummon(options);
}
ummon.createServer = function(options){
  return new Ummon(options);
};

function Ummon (options) {
  if (!options) { options = {}; }

  var self = this;

  self.tasks = {};
  self.queue = [];
  
  self.log.transports.console.level = 'info';
}


/**
 * [log description]
 * @type {[type]}
 */
var log = Ummon.prototype.log = new winston.Logger({
  transports: [
    new winston.transports.Console({
      //handleExceptions: true
    })
  ],
  //exitOnError: false
});
log.cli();


/**
 * Add task to queue
 */
// Ummon.prototype.addTasks = function(tasks){
//   var self = this;
//   for (var name in tasks) {
//     self.addTask.call(self, name, tasks[name]);
//   }
// };

/**
 * Add a task to the task collection
 *
 * Example:
 *   server.addTask('task1', {
 *       "cwd": "/var/www/website2/",
 *       "command": "sleep 5 && echo 'Task Finished'",
 *       "arguments": ["--verbose", "--env=staging"]
 *       
 *     }, function(err){
 *       t.notOk(err, 'No error');
 *       t.type(server.tasks.task1, 'object', 'Task should be first object in queue');
 *       t.equal(server.tasks.task1.command, "sleep 5 && echo 'Task Finished'", 'Task command should be correct');
 *       t.end();
 *     });
 * 
 * @param {string}   name     The unique name of the task
 * @param {Object}   task     The meta-data about the task
 * @param {callback} callback Call if success, call with error if error
 */
Ummon.prototype.addTask = function(name, task, callback){
  var self = this;
  log.info('Adding new task: ' + name);
  
  if (Object.keys(self.tasks).indexOf(name) !== -1) {
    return callback(new Error('A task with that name already exists'));
  }
  
  self.tasks[name] = task;

  callback();
};


/**
 * Enqueue a task
 */
Ummon.prototype.enqueueTask = function(name, callback){
  var self = this;
  log.info('Enqueuing task: ' + name);
  
  if (Object.keys(self.tasks).indexOf(name) === -1) {
    return callback(new Error('That task doesn\t exists'));
  }

  self.queue.push(self.tasks[name]);

  callback();
};