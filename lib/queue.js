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
var Queue = function(options, ummon){
  var self = this;

  if (!ummon && "config" in options) {
    ummon = options;
    options = {};
  }

  self.maxSize = options.maxSize || 500;
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
function queue(options, ummon) {
  return new Queue(options, ummon);
}


/**
 * Create a task run and add it to the queue
 *
 * @param  {object} task    A task object
 * @param  {string} trigger Simply "timer" or a Run
 */
Queue.prototype.push = function(task, trigger, callback){
  if (!callback && 'function' == typeof trigger) {
    callback = trigger;
    trigger = false;
  }

  //check for duplicate tasks (this can happend when a task takes longer to complete than it timer)
  //tasks with an "after" or "afterFailed" trigger are ok to add
  var duplicate = false;
  for (var i = 0; i < this.items.length; i++) {
    if (this.items[i]['task']['id'] == task['id']) {
      if( !trigger && !trigger.after && !trigger.afterFailed) {
        duplicate = true;
        break;
      }
    }
  }

  if (this.items.length >= this.maxSize) {
    var error = new Error('Queue is full ('+this.maxSize+'). Cannot create run for task '+task.id+'. Consider investigating...');
    this.ummon.log.error(error)
    if (callback) {
      return callback(error)
    }
  }

  //do not add duplicate tasks to the queue
  if (!duplicate) {
    var r = run(task, trigger);

    this.items.push(r);
    this.ummon.emit('queue.new', r);
  
    if (callback) {
      callback(null, r);
    }
  }
};


/**
 * Clear a task from the queue or clear the entire queue
 */
Queue.prototype.clear = function(task){
  var self = this;
  if (task) {
    self.items = _.filter(self.items, function(item){
      return (item.task.id !== task);
    }, self)
  } else {
    self.items = [];
  }
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
  }

  return false;
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


/**
 * Return an array of the task ids currently in the queue
 *
 * @return {array}                An array of task names
 */
Queue.prototype.getPresentTaskIds = function() {
  var self = this;

  return (self.items.length)
      ? _.map(self.items, function(item) {return item.task.id})
      : [];
};