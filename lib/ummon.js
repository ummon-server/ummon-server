'use strict';

/**
 * Module dependencies.
 */

var winston = require('winston');

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
    new winston.transports.Console({
      //handleExceptions: true
    })
  ],
  //exitOnError: false
});
log.cli();


/**
 * Add task to a specified collection
 *
 * This is a shorthand function which passes through to the specified collection
 */
Ummon.prototype.createTask = function(collection, taskName, task){
  var self = this;
  
  self.collections[collection].add(taskName, task);
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

  workerProcess.once('complete', function(data){
    delete self.workers[self.workers.indexOf(workerProcess.pid)];
    console.log("worker is complete and exited with "+data);

    self.runNextIfReady();
  });
};