'use strict';


/*
 * Exports
 */
module.exports = queue;
exports.Queue = Queue;


/**
 * The Queue
 * 
 * @param {EventEmitter2} dispatcher
 */
var Queue = function(ummon){
  var self = this;

  self.items = [];
  self.ummon = ummon;
};


/**
 * A simple queue constructor helper
 *
 * Example:
 * 
 *     var queue = require('./queue');
 *     
 *     var aQueue = queue();
 */
function queue(dispatcher) {
  return new Queue(dispatcher);
}


/**
 * Add a task to the queue
 *
 * Assume task is an instance of Task.
 * 
 * Potentially useful additional meta data:
 *  * timestamps: added, started
 */
Queue.prototype.push = function(task){
  this.items.push(task);
  this.ummon.dispatcher.emit('queue.new', task);
};


/**
 * Delete a task to the queue
 */
Queue.prototype.delete = function(key){
  delete this.items[key];
};


/**
 * Get the queue length
 */
Queue.prototype.length = function(){
  return this.items.length;
};


/**
 * Get a specific task from the queue
 *
 * @returns {object} A full Task object from the top of the queue
 */
Queue.prototype.getNext = function(){
  var task = this.items.shift();
  
  if (this.length() === 0) {
    this.ummon.dispatcher.emit('queue.empty');
  }

  return task;
};


/**
 * See if there is anything in the queue
 *
 * @returns {object} A full Task object from the top of the queue
 */
Queue.prototype.hasNext = function(){
  var self = this;

  return (self.length());
};