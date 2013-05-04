'use strict';

/**
 * Module dependencies.
 */
var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var bunyan = require('bunyan');
var cronJob = require('cron').CronJob;
var EventEmitter2 = require('eventemitter2').EventEmitter2;
    
var collection = require('./collection');
var queue = require('./queue');
var worker = require('./worker');


/**
 * Exports
 */
module.exports = ummon;

// Can decide on the api here
function ummon(options){
  return new Ummon(options);
}
ummon.create = function(options){
  return new Ummon(options);
};

// Expose the constructor for potential inheritance
ummon.Ummon = Ummon;


/**
 * Ummon
 * 
 * @param {object} options configuration options
 */
function Ummon(options){
  if (!options) { options = {}; }

  var self = this;

  self.dispatcher = new EventEmitter2({
    wildcard: true, // should the event emitter use wildcards.
    newListener: false, // if you want to emit the newListener event set to true.
    maxListeners: 20, // the max number of listeners that can be assigned to an event, defaults to 10.
  });

  // Load config
  var defaults = require(path.join(__dirname, '../config/config.defaults.json')); // Load config.defaults.json
  var config = {};
  
  if (options.configPath) {
    var configPath = path.normalize(options.configPath); // Get the full path to the current themes _config.json
    config = (fs.existsSync(configPath)) ? require(configPath) : {};
  }

  self.config = _.extend(defaults, config, options);

  self.MAX_WORKERS = 5;
  self.workers = {};

  // Create the default collection
  self.collections = {
    default: collection('default')
  };
  
  self.timers = {};
  self.queue = queue(self);
  
  // Setup listeners
  self.dispatcher.on('queue.new', function(task){
    self.log.info("The task %s.%s was added to the queue", task.collection, task.name);

    self.runNextIfReady();
  });
}


/**
 * [log description]
 * @type {[type]}
 */
Ummon.prototype.log = bunyan.createLogger({
  name: 'ummon',
  stream: process.stdout,
  level: 'info'
});


/**
 * Add task to a specified collection
 *
 * This is a shorthand function which passes through to the specified collection
 *
 * Example:
 *
 *    ummon.createTask({ collection:'default', name:'sleep', command:'sleep 5'...});
 *
 *    ummon.createTask({ name:'sleep', command:'sleep 5'...});
 * 
 * @param  {Object} config       Task config object
 */
Ummon.prototype.createTask = function(config){
  var self = this;
  
  if (!config.name) {
    self.log.error(new Error('No task name provided for task: '+config.command));
  }

  if (!config.collection) { config.collection = 'default'; }

  var task = self.collections[config.collection].add(config);

  self.createTimer(task);

  return task;
};


/**
 * Create a timer using cronJob
 * 
 * @param  {Task} task
 */
Ummon.prototype.createTimer = function(task){
  var self = this;

  if (task.trigger.time !== null) {
     var timer = new cronJob({
      cronTime: task.trigger.time,
      onTick: function() {
        self.queue.push(self.collections[task.collection].tasks[task.name]);
      },
      start: true
    });

    // Keep track of all the timers
    self.timers[task.collection+'.'+task.name] = timer;
  }
};


/**
 * Show the details for a particular task
 * 
 * @param  {String} collection A collection name
 * @param  {String} task       A Task name
 * @return {Task}
 */
Ummon.prototype.showTask = function(collection, task){
  var self = this;
  if (!task) { task = collection; collection = 'default'; }

  return self.collections[collection].tasks[task];
};


/**
 * Update an existing task
 *
 * This include any timers related to the task
 * 
 * @param  {Task} config   Config data
 * @return {Task}        The updated task
 */
Ummon.prototype.updateTask = function(config){
  var self = this;

  //TODO: This should go through the collection like the create task
  //TODO: Make sure to update dependant tasks
  self.collections[config.collection].tasks[config.name] = config;

  if (self.timers[config.collection+"."+config.name] !== typeof "undefined") {
    delete self.timers[config.collection+"."+config.name];
  }

  if (config.trigger.time) {
    self.createTimer(config);
  }

  return self.collections[config.collection].tasks[config.name];
};


Ummon.prototype.deleteTask = function(collection, task){
  var self = this;

  delete self.timers[collection+"."+task];
  //TODO: This should go through the collection like the create task
  //TODO: Make sure to update dependant tasks
  delete self.collections[collection].tasks[task];

  return true;
};


/**
 * Is Ummon ready to run a task? 
 *
 * ready = workers.length < MAX_WORKERS
 */
Ummon.prototype.ready = function(){
  return (Object.keys(this.workers).length < this.MAX_WORKERS && this.queue.hasNext());
};


/**
 * Run the next task in the queue if ummon is ready
 */
Ummon.prototype.runNextIfReady = function(){
  var self = this;

  if (self.ready()){
    self.run(self.queue.getNext());
  }
};


/**
 * Run a task!
 */
Ummon.prototype.run = function(task){
  var self = this;

  var workerProcess = worker(task, self);
  
  self.workers[workerProcess.pid] = workerProcess;

  self.dispatcher.once('worker.complete', function(exitCode){
    // Cleanup
    delete self.workers[workerProcess.pid];

    // Queue dependant tasks
    var collection = self.collections[task.collection];
    var refs = collection.dependencies.subject(task.name).references;
    
    if (refs.length && exitCode === 0) {
      for (var index = 0; index < refs.length; index++) {
        self.queue.push(collection.tasks[refs[index]]);
      }
    }

    self.runNextIfReady();
  });
};