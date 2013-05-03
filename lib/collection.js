'use strict';

/*!
 * Module dependencies.
 */
var DependencyGraph = require('dependency-foo');

var task = require('./task');


/**
 * Exports
 */
module.exports = collection;
exports.Collection = Collection;



/**
 * The Task Collection Constructor
 *
 * @param  {string} name   The name of the collection
 * @param  {object} config Any additional configuration options for the collection
 */
function Collection(name, config){
  if (!name) {
    return new Error('You must specify a collection name');
  }

  if (!config) { config = {}; }

  this.name = name;
  this.tasks = {};
  this.dependencies = new DependencyGraph();
}



/**
 * A simple constructor helper
 *
 * Example:
 * 
 *     var collection = require('./collection');
 *     var taskCollection = collection('default');
 *    
 * @param  {string} name   The name of the collection
 * @param  {object} config Any additional configuration options for the collection
 */
function collection(name, config) {
  return new Collection(name, config);
}


/**
 * Add a task to the task collection
 *
 * Example:
 *     collection.addTask('task1', {
 *       "cwd": "/var/www/website2/",
 *       "command": "sleep 5 && echo 'Task Finished'",
 *       "arguments": ["--verbose", "--env=staging"]
 *     });
 * 
 * @param {string}   name     The unique name of the task
 * @param {Object}   task     The meta-data about the task
 */
Collection.prototype.add = function(config){
  var self = this;
  var name = config.name;
  
  if (Object.keys(self.tasks).indexOf(name) !== -1) {
    throw new Error('A task with that name already exists in collection:'+self.name);
  }

  // Err. Scope hack? Make it easy to reference the tasks collection
  config.collection = self.name;

  self.tasks[name] = task(name, config);

  if (self.tasks[name].trigger.after) {
    self.dependencies.subject(name).dependOn(self.tasks[name].trigger.after);
  }

  if (self.tasks[name].trigger.before) {
    self.dependencies.subject(self.tasks[name].trigger.before).dependOn(name);
  }

  // TODO: How should failed task dependancies be tracker? self.dependenciesFailed
  // if (self.tasks[name].trigger.afterFail) {
  //  
  // }  

  return self.tasks[name];
};


/**
 * Delete a task from the collection
 * 
 * @param  {string} name The task name to delete
 */
Collection.prototype.delete = function(name){
  var self = this;

  delete self.tasks[name];
};


/**
 * Update a task
 * 
 * @param  {string} name   The task to update
 * @param  {object} config The configuration settings to replace the exiting task settings with
 */
Collection.prototype.update = function(name, config){
  var self = this;

  self.tasks[name] = task(name, config);
};

