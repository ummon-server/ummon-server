'use strict';

/**
 * Module dependencies.
 */

var winston = require('winston');
var cronJob = require('cron').CronJob;

var collection = require('./collection');
var queue = require('./queue');
var worker = require('./worker');


/**
 * Exports
 */
module.exports = ummon;

// Can decide on the api here
function ummon (options) {
  return new Ummon(options);
}
ummon.createServer = function(options){
  return new Ummon(options);
};

// Expose the constructor for potential inheritance
ummon.Ummon = Ummon;


/**
 * Ummon
 * 
 * @param {object} options configuration options
 */
function Ummon (options) {
  if (!options) { options = {}; }

  var self = this;

  self.MAX_WORKERS = 5;
  self.workers = [];

  // Create the default collection
  self.collections = {
    default: collection('default')
  };
  
  self.timers = [];
  self.queue = queue();
  
  self.log.transports.console.level = 'info';


  // Setup listeners
  self.queue.on('new', function(){
    log.info("A task was added to the queue");

    self.runNextIfReady();
  });
}


/**
 * [log description]
 * @type {[type]}
 */
var log = Ummon.prototype.log = new winston.Logger({
  transports: [
    new winston.transports.Console()
  ]
});
log.cli();


/**
 * Add task to a specified collection
 *
 * This is a shorthand function which passes through to the specified collection
 *
 * Example:
 *
 *    ummon.createTask('default', 'sleep', {command:'sleep 5'...});
 *
 *    ummon.createTask('sleep', {command:'sleep 5'...});
 * 
 * @param  {String} collection *OPTIONAL* Collection name. Defaults to default
 * @param  {String|Object} taskName or task  The unique name of the task 
 * @param  {Object} config       Task config object
 */
Ummon.prototype.createTask = function(collection, taskName, config){
  var self = this;
  
  // If only two arguments are provided, assume collection is default
  if (typeof taskName === 'object') {
    taskName = collection;
    config = taskName;
    collection = 'default';
  }

  var task = self.collections[collection].add(taskName, config);

  if (task.trigger.time !== null) {
     var timer = new cronJob({
      cronTime: task.trigger.time,
      onTick: function() {
        self.queue.push(self.collections[collection].tasks[taskName]);
      },
      start: true
    });
    
    // Keep track of all the timers
    self.timers.push(timer);
  }
};


/**
 * Is Ummon ready to run a task? 
 *
 * ready = workers.length < MAX_WORKERS
 */
Ummon.prototype.ready = function(){
  return (this.workers.length < this.MAX_WORKERS && this.queue.hasNext());
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

  var workerProcess = worker(task);
  
  self.workers.push(workerProcess.pid);

  workerProcess.once('complete', function(exitCode){
    delete self.workers[self.workers.indexOf(workerProcess.pid)];
    log.info("worker for " + task.name + " is complete and exited with "+exitCode);

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