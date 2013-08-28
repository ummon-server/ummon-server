'use strict';

var run = require('./run');
var _ = require('underscore');

/*!
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
 * @param  {string} trigger Simply "timer" or a Run
 */
Queue.prototype.push = function(task, trigger, callback){
  // console.log(trigger)
  var r = run(task, trigger);

  this.items.push(r);
  this.ummon.emit('queue.new', r);

  if (callback) {
    callback(null, r);
  }
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
 * Return the next run to start. Will skip any tasks that
 * are currently running
 *
 * @param {array} runningTaskIds   An list of all the task ids that are currently running
 * @returns {object} A full Task object from the top of the queue
 */
Queue.prototype.getNext = function(runningTaskIds){
  var self = this;

  if (!runningTaskIds) { runningTaskIds = [] }

  for (var index = 0; index < self.items.length; index++) {
    if (runningTaskIds.indexOf(self.items[index].task.id) === -1) {
      var run = self.items.splice(index, 1)[0];
      self.ummon.emit('queue.shift', run);
      return run;
    }
  };
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