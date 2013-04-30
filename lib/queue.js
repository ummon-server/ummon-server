'use strict';

/*!
 * Module dependencies.
 */
var util = require("util");
var events = require("events");
// var _ = require("underscore");


/*
 * Exports
 */
module.exports = queue;
exports.Queue = Queue;


/**
 * The Queue
 *
 * * A Queue is a FIFO group of tasks
 * * A task is added by a ?
 * * A worker listens for certain events: ?
 *     * new
 *     * ready?
 */
var Queue = function(){
  events.EventEmitter.call(this);

  var self = this;

  self.items = [];
};

util.inherits(Queue, events.EventEmitter);


/**
 * A simple queue constructor helper
 *
 * Example:
 * 
 *     var queue = require('./queue');
 *     
 *     var aQueue = queue();
 */
function queue() {
  return new Queue();
}


// Notes on eventEmitter
// - - - - - - - - - - - - - - -
// Queue.prototype.write = function(data) {
//   this.emit("data", data);
// }
// 
// var queue = new Queue();
// 
// queue.on("data", function(data) {`
//   console.log('Received data: "' + data + '"');
// })
// 
// queue.write("It works!"); // Received data: "It works!"


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
  this.emit('new', task.name);
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
  return this.items.shift();
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