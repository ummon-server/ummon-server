'use strict';

var run = require('./run');

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
 * Create a task run and add it to the queue
 * 
 * @param  {object} task    A task object
 * @param  {string} trigger Simply "timer" or a run.id
 */
Queue.prototype.push = function(task, trigger){
  var r = run(task);

  r.triggeredBy = trigger;

  this.items.push(r);
  this.ummon.dispatcher.emit('queue.new', r);
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
  var run = this.items.shift();
  
  if (this.length() === 0) {
    this.ummon.dispatcher.emit('queue.empty');
  }

  return run;
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