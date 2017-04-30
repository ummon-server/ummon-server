'use strict';

/*!
 * Module dependencies.
 */
var fs = require('fs');
var path = require('path');
var util = require('util');
var _ = require('underscore');
var bunyan = require('bunyan');
var async = require('async');
var mkdirp = require('mkdirp');
var domain = require('domain');
var DependencyGraph = require('dependency-foo');
var cronJob = require('cron').CronJob;
var EventEmitter2 = require('eventemitter2').EventEmitter2;
var colors = require('colors');

var queue = require('./queue');
var worker = require('./worker');
var db = require('../db');

// Constant list of fields permissible for a task to have
var TASK_FIELDS =  ['name', 'collection', 'command', 'cwd', 'env', 'trigger', 'enabled', 'description'];

/*!
 * Exports
 */
module.exports = ummon;

function ummon(options){
  return new Ummon(options);
}

// Expose the constructor for potential inheritance
ummon.Ummon = Ummon;

ummon.loadConfig = loadConfig;

// Inherit the EvenetEmitter2 constructuor
util.inherits(Ummon, EventEmitter2);


/**
 * Ummon constructor
 *
 * @param {object} options configuration options
 */
function Ummon(options){
  var self = this;

  // Call the EvenetEmitter2 constructor
  EventEmitter2.call(self, {
    wildcard: true, // should the event emitter use wildcards.
    newListener: false, // if you want to emit the newListener event set to true.
    maxListeners: 20, // the max number of listeners that can be assigned to an event, defaults to 10.
  });

  var d = domain.create();

  d.on('error', er => {
    console.error('Ummon Errored while starting up', er.stack);
    process.exit(1);
  });

  d.run(() => {
    if (!options) { options = {}; }

    self.loadConfig(options);

    // Cleanup paths and make any folders that need to be made
    self.config.log.path = path.resolve(self.config.log.path);
    mkdirp.sync(path.dirname(self.config.log.path));


    self.log = bunyan.createLogger({
      name: 'ummon',
      streams: [
        {
          level: 'debug',
          stream: process.stdout // log INFO and above to stdout
        },
        {
          type: 'rotating-file',
          level: self.config.log.level,
          path: self.config.log.path,  // log ERROR and above to a file
          period: self.config.log.period,  // log ERROR and above to a file
          count: self.config.log.count  // log ERROR and above to a file
        }
      ],
      serializers: bunyan.stdSerializers
    });

    self.defaults = {};
    self.tasks = {};
    self.timers = {};
    self.workers = {};
    self.dependencies = {
      'success': new DependencyGraph(),
      'error': new DependencyGraph()
    }
    self.queue = queue({maxSize: self.config.maxQueueSize}, self);

    // Set max workers to the # of CPUS * 1.25
    self.MAX_WORKERS = Math.ceil(require('os').cpus().length * self.config.workerToCpuRatio);

    // Check if there is a task in the queue that can be run. See config.createWorkerPollInterval
    self.poll = setInterval(createWorkerIfReady, self.config.createWorkerPollInterval);

    // This could be in the constructor it just felt cleaner in another place
    self.setupListeners();

    // Setup the "database"
    db = db(self);

    // Automatically load tasks from a config file
    if (self.config.tasksPath) {
      var oldAutoSave = self.config.autoSave;
      self.config.autoSave = false; // Don't save while things are loading
      db.loadTasks(err => {
        if (err) {
          self.log.error(err);
        }
        self.config.autoSave = oldAutoSave;
      });
    }
  });
}


/**
 * Load the config from defaults, user provided config and any config items
 * passed directly to the ummon constructor
 *
 * @param  {Object} options   An object with a path to a config file to load
 * @return {Object}
 */
function loadConfig(options) {
  // Load config
  var defaults = require(path.join(__dirname, '../config/config.defaults.json')); // Load config.defaults.json
  var config = {};
  if (!options) options = {};

  if (options.configPath) {
    if (fs.existsSync(options.configPath)) {
      config = require(options.configPath);
    } else {
      // self.log isn't setup until after config is loaded
      console.warn('');
      console.warn('The config file you passed does not exist: %s'.yellow, options.configPath);
      console.warn('');
    }
  } else if (fs.existsSync(defaults.configPath)) {
    config = require(path.resolve(defaults.configPath));
  }

  return _.extend(defaults, config, options);
}

Ummon.prototype.loadConfig = function(options){
  var self = this;

  self.config = loadConfig(options);
}


Ummon.prototype.setupListeners = function(taskid) {
  var self = this;

  // Anytime a task is changed (new, update, delete)
  //   1. Make sure any wildcard triggers dependencies are reconfigured
  //   2. Save the tasks to files
  self.on('task.*', taskid => {
    var wildCardTriggerTasks = _.filter(self.tasks, task => {
      // Skip tasks without triggers or the task that just changed
      if (!('trigger' in task) || task.id === taskid) { return false }

      return (
        (task.trigger.after && ~task.trigger.after.indexOf('*'))
        || (task.trigger.afterFailed && ~task.trigger.afterFailed.indexOf('*'))
      )
    })


    if (self.config.autoSave) {
      // If there has been a save, and more than the minimal save interval has passed, save again!
      db.saveTasks();
    }
  });

  // Every time something is added the queue, log it and try to create a worker
  self.on('queue.new', r => {
    self.log.info({
      event: 'queue.new',
      runid: r.id,
      taskid: r.task.id,
      collection: r.task.collection
    }, "queue.new - %s added. Queue length: %d", r.task.id, self.queue.length());

    self.createWorkerIfReady();
  });


  // If a worker completes: Delete the worker & run dependent tasks
  self.on('worker.complete', completedRun => {
    // Cleanup
    delete self.workers[completedRun.pid];

    // Update task object and Queue dependent tasks
    if (completedRun.task.id) {
      var task = self.tasks[completedRun.task.id];
      var status = (completedRun.exitCode === 0) ? 'success' : 'error';

      // No task for one-off commands
      if (task) {
        // If there are 10 exit codes, remove the oldest
        if (task.recentExitCodes.length === 10) {
          task.recentExitCodes.shift();
        }

        task.recentExitCodes.push(completedRun.exitCode);

        if (status === 'success') {
          task.lastSuccessfulRun = completedRun.completed
        }
      }

      var refs = self.getTaskReferences(completedRun.task.id, status);
      // If there is dependent tasks and the previous task was successfull, GO!
      refs.forEach(ref => {
        self.log.debug({event: 'worker.complete'}, '%s triggered %s', completedRun.task.id, ref);
        self.queue.push(self.getTaskSync(ref), completedRun);
      })
    }
  });
};


/**
 * Does a task exist?
 *
 * @param  {string} name a task name
 * @return {boolean}
 */
Ummon.prototype.doesTaskExist = function(name){
  if (!name) return false;

  var checkName = task => {
    if (name === '*') {
      return true;
    }
    else if (name.indexOf('.*') !== -1) {
      return (task.indexOf(name.replace('*','')) === 0);
    } else {
      return (name === task);
    }
  }

  return this.getTaskIds().some(checkName);
};


/**
 * Helper method to ensure that a task is enabled
 *
 * It checks the local task's settings as well as it's
 * collection settings
 *
 * @param  {Task}  task
 * @return {Boolean}      Boolean of whether the task should be enabled
 */
Ummon.prototype.isTaskEnabled = function(task) {
  var self = this;
  return (task.enabled && self.config.collections[task.collection].enabled);
}


/**
 * Return an array of all of the collection names
 *
 * @return {Array} All collection names
 */
Ummon.prototype.getCollections = function(selector){
  var self = this;

  return _.union(Object.keys(self.defaults), _.pluck(self.tasks, 'collection'));
};


/**
 * Return an array of all of the task ids
 *
 * @augments {String} Optional wildcar selector, eg: "ummon.*"
 * @return {Array} All collection names
 */
Ummon.prototype.getTaskIds = function(selector){
  var self = this;

  var taskids = Object.keys(self.tasks);

  if (!selector || selector === '*') {
    return taskids;
  } else {
    // Assume the selector is "ummon.*" and remove the star
    if (selector.indexOf('*') !== -1) {
      selector = selector.substr(0, selector.length-1);
    }

    return _.filter(taskids, id => id.indexOf(selector) === 0);
  }
};


/**
 * Return a proper task id. ie: allow the user to only
 * pass a task name, like doThisThing and it will auto
 * append the default collection name for you
 *
 * @param  {string} name
 * @return {string}
 */
Ummon.prototype.getTaskId = function (name, task) {
  var self = this;
  var id;

  // Don't mess with non-strings
  if ('string' !== typeof name) return false;

  // If the name already contains a dot or star just return it as the ID
  if (name.indexOf('.') !== -1 || name.indexOf('*') !== -1) {
    return name;
  }

  // If the name is a task in this task's collection return that
  id = task && task.collection+'.'+name;
  if (self.doesTaskExist(id)) {
    return id;
  } 
  
  // Check for it in the default collection
  id = this.config.defaultCollection+'.'+name;
  if (self.doesTaskExist(id)) {
    return id;
  }

  // Return false if it doesn't exist
  return false;
};


/**
 * Add task to a specified collection
 *
 * This is a shorthand function which passes through to the specified collection
 *
 * Example:
 *
 *   ummon.createTask({ collection:'default', name:'sleep', command:'sleep 5'...}, function(err, task){});
 *
 *   ummon.createTask({ name:'sleep', command:'sleep 5'...}, function(err, task){});
 *
 * @param  {Object} config       Task config object
 * @param {function} callback   Return the full task object (including defaults)
 */
Ummon.prototype.createTask = function(config, callback){
  var self = this;

  if (!config.command){ return callback(new Error('No command provided! Please provide one')); }
  if (!config.name){ return callback(new Error('No task name provided for task: ' + config.command)); }
  if (!config.collection) { config.collection = self.config.defaultCollection; }
  // Assumed enabled by default
  if (!("enabled" in config)) { config.enabled = true; }
  var id = config.collection + '.' + config.name;

  if (self.getTaskIds().indexOf(id) !== -1) {
    return callback(new Error('A task with name "' + id + '" already exists')) ;
  }

  self.log.info("Creating task "+id);

  // If no collection settings are setup, create them
  // Assume collections are enabled by default
  if (!self.config.collections[config.collection]) {
    self.config.collections[config.collection] = {
      enabled: true
    }
  }

  self.tasks[id] = {
    id,
    lastSuccessfulRun: null,
    recentExitCodes: []
  };

  TASK_FIELDS.forEach(key => {
    if (key in config) {
      self.tasks[id][key] = config[key];
    }
  })

  self.setupTaskTriggers(self.tasks[id]);

  self.emit('task.new', id);

  // self.getTask(id, callback);
  callback(null, self.tasks[id]);
};


/**
 * Cleanup task structure and enable triggers
 *
 * @param  {[type]} task [description]
 * @return {[type]}      [description]
 */
Ummon.prototype.setupTaskTriggers = function(task) {
  var self = this;
  // Setup triggers if the task is enabled
  if (task.trigger) {

    // Convert shorthand to better long hand
    if ('string' === typeof task.trigger) {
      task.trigger = (isCronTime(task.trigger))
        ? { time: task.trigger }
        : { after: task.trigger }
    }

    ['after', 'afterFailed'].forEach(key => {
      if (key in task.trigger) {
        task.trigger[key] = self.getTaskId(task.trigger[key], task)
      }
    })


    if ('time' in task.trigger) {
      self.createTimer(task);
    }
  }
}


Ummon.prototype.removeTaskTriggers = function(tid) {
  var self = this;

  self.log.info("Removing triggers for task %s", tid)

  // If a timer exists, stop it and remove the reference
  if (self.timers[tid]) {
    self.timers[tid].stop();
    delete self.timers[tid];
  }
}


/**
 * Get the tasks that reference the provided task as a trigger (that is, 
 * tasks that will be triggered by this task).
 *
 * @param  {String} taskid [description]
 * @param  {String} [status=success] The tree for a particular exit status
 * @return {[String]}        An array of task IDs
 */

Ummon.prototype.getTaskReferences = function(taskid, status) {
  var self = this;
  var taskReferences = [];
  var triggerKey = 'after';
  var triggerTaskIds;

  if (status && status !== 'success') triggerKey = 'afterFailed';

  // Loop over all tasks and look for this task in the triggers
  for (var id in self.tasks) {
    // A task can't reference itself
    if (id === taskid) continue;

    // Does this task even have triggers?
    if (self.tasks[id].trigger && triggerKey in self.tasks[id].trigger) {
      triggerTaskIds = self.getTaskIds(self.tasks[id].trigger[triggerKey]);

      if (triggerTaskIds.indexOf(taskid) !== -1) {
        taskReferences.push(id);
      }
    }
  }

  return taskReferences;
}


/**
 * Get the tasks that depend upon the provided task (that is, tasks that 
 * this task will trigger).
 *
 * @param  {String} taskid [description]
 * @param  {String} [status=success] The tree for a particular exit status
 * @return {[String]}        An array of task IDs
 */

Ummon.prototype.getTaskDependencies = function(taskid, status) {
  var self = this;
  var taskDependencies;
  var triggerKey = 'after';
  var triggerTaskIds;

  if (status && status !== 'success') triggerKey = 'afterFailed';

  // Get the tasks that would be triggered by this task
  if (taskid in self.tasks
      && self.tasks[taskid].trigger
      && triggerKey in self.tasks[taskid].trigger) {
    triggerTaskIds = self.getTaskIds(self.tasks[taskid].trigger[triggerKey]);

    taskDependencies = triggerTaskIds.filter(triggerTaskId => // Don't let a task depend upon itself
    triggerTaskId !== taskid);
  }

  return taskDependencies || [];
}


/**
 * Create a timer using cronJob
 *
 * @param  {Task} t
 */
Ummon.prototype.createTimer = function(t){
  var self = this;

  if (t.trigger.time && self.isTaskEnabled(t)) {
    try {
        new cronJob(t.trigger.time, () => {
            console.log('this should not be printed');
        })
    } catch(ex) {
        return self.log.error('Trigger time (%s) provided for %s is not a valid cron time', t.trigger.time, t.id);
    }

    var timer = new cronJob({
      cronTime: t.trigger.time || t.trigger,
      onTick() {
        self.queue.push(self.getTaskSync(t.id), 'timer');
      },
      start: true
    });

    // Keep track of all the timers
    self.timers[t.id] = timer;
  }
}


/**
 * Setup a collection and it's associated tasks
 *
 * @see  autoLoadTasks
 * @param  {Object}   config     Config object from json
 * @param  {Function} callback   The callback. Simply returns true if all goes well
 */
Ummon.prototype.createCollectionAndTasks = function(config, callback) {
  var self = this;
  // Setup the defaults for this collection
  self.defaults[config.collection] = config.defaults;

  // Setup settings
  if (config.config) {
    self.config.collections[config.collection] = config.config;
  } else {
    // Default collection config
    self.config.collections[config.collection] = {enabled:true};
  }

  // Iterate over tasks (if they exist) and create them
  if (!config.tasks) return callback(new Error('Collection config must include tasks'));
  var tasks = Object.keys(config.tasks);
  var pending = tasks.length;
  var called;
  tasks.forEach(task => {
    // Rearrange task config for createTask
    var taskConfig = config.tasks[task];
    taskConfig.name = task;
    taskConfig.collection = config.collection;
    self.createTask(taskConfig, (err, task) => {
      // Only call callback with error once
      if (err && !called && (called=true)) return callback(err);
      if (!--pending) callback();
    });
  });
};


/**
 * Update a collection and it's associated tasks. The new config will fully overwrite - update tasks if appropriate,
 * create them if appropriate, delete them from ummon if it doesn't exist in the new config passed
 *
 * @see  autoLoadTasks
 * @param  {Object}   config     Config object from json
 * @param  {Function} callback   The callback. Simply returns true if all goes well
 */
Ummon.prototype.updateCollectionAndTasks = function(config, callback) {
  var self = this;
  // Setup the defaults for this collection
  self.defaults[config.collection] = config.defaults;

  // Setup settings
  if (config.config) {
    self.config.collections[config.collection] = config.config;
  } else {
    // Default collection config
    self.config.collections[config.collection] = {enabled:true};
  }
  if (!config.tasks) return callback(new Error('Collection config must include tasks'));

  var newTasks = Object.keys(config.tasks);
  var oldTasks = _.pluck(_.where(self.tasks, {collection: config.collection}),'name');
  var allTasks = _.union(oldTasks, newTasks);

  var hasError = false;
  var cb = err => {
    if (err) {
      hasError = true;
      callback(err);
    }
  };

  _.each(allTasks,taskid => {
    if (_.contains(newTasks,taskid) && !_.contains(oldTasks,taskid)) {
      // Create
      self.log.info('Creating task '+taskid);
      // Rearrange task config for createTask
      var taskConfig = config.tasks[taskid];
      taskConfig.name = taskid;
      taskConfig.collection = config.collection;
      self.createTask(taskConfig, cb);
    } else if (!_.contains(newTasks,taskid) && _.contains(oldTasks,taskid)) {
      // Delete
      self.log.info('Deleting task '+taskid);
      self.deleteTask(config.collection+'.'+taskid, cb);
    } else if (_.contains(newTasks,taskid) && _.contains(oldTasks,taskid)) {
      // Update
      self.log.info('Updating task '+taskid);
      self.updateTask(config.collection+'.'+taskid, config.tasks[taskid], cb);
    }
  });
  if (!hasError) callback(null);
};


/**
 * Show the details for a particular task
 *
 * @param  {String} tid       A Task id
 * @param {function} callback
 */
Ummon.prototype.getTask = function(tid, callback){
  var self = this;

  var task = self.getTaskSync(tid);

  if (task === false) {
    return callback('Task does not exists')
  }

  callback(null, task);
};


/**
 * Show the details for a particular task. Sync style!
 *
 * @param  {String} tid       A Task id
 * @return {Object} The task
 */
Ummon.prototype.getTaskSync = function(tid){
  var self = this;

  if (!(tid in self.tasks)) { return false };

  // Clone the task
  var task = JSON.parse(JSON.stringify(self.tasks[tid]));
  var defaults = self.defaults[task.collection] || {};
  var globalDefaults = self.config.globalTaskDefaults || {};

  if (!task) {
    return callback(new Error("There is no task with the id of %s", tid));
  }

  _.defaults(task, defaults, globalDefaults);

  // Go over special cases like env
  if (task.env) {
    _.defaults(task.env, defaults.env || {}, globalDefaults.env || {});
  }

  return task;
};


/**
 * Get many tasks
 *
 * @param  {Function} callback
 */
Ummon.prototype.getTasks = function(filter, callback){
  var self = this;
  var results = [];
  var allCollections = self.getCollections();

  var filteredCollections = [];
  var taskid = false;

  // If the explicit wildcard pattern is present, strip it
  if (filter && filter.indexOf('.*') !== -1) {
    filter = filter.substr(0, filter.length-2)
  }

  // If the filter is a task id
  if (self.tasks[filter]) {
    filteredCollections = [self.tasks[filter].collection];
    taskid = filter;

  // If the filter is a collection
  } else if (allCollections.indexOf(filter) !== -1) {
    filteredCollections = [filter]

  // If the filter is task name of a task in the default collection
  } else if (self.tasks[self.config.defaultCollection+"."+filter]) {
    taskid = self.config.defaultCollection+"."+filter;
    filteredCollections = [self.tasks[taskid].collection];

  // If there a filter but it hasn't triggered, error
  } else if (filter) {
    return callback(new Error("There is no tasks or collections that match the provided filter"))

  // Else show everything
  } else {
    filteredCollections = allCollections;
  }


  // Loop through each desired collection and create its object
  filteredCollections.forEach(collection => {
    var collectionTasks = {};

    _.each(self.tasks, task => {
      // If a specific task has been set
      if (taskid) {
        if (task.id === taskid) {
          return collectionTasks[task.name] = task;
        } else {
          return;
        }
      }

      if (task.collection === collection) {
        collectionTasks[task.name] = task;
      }
    });

    results.push({
      collection,
      defaults: self.defaults[collection],
      config: self.config.collections[collection],
      tasks: collectionTasks
    });

  });
  callback(null, results);
};


/**
 * Update an existing task
 *
 * This include any timers related to the task
 *
 * @param  {Task} config   Config data
 * @param {Function}    callback
 */
Ummon.prototype.updateTask = function(taskid, options, callback){
  var self = this;

  if (!(taskid in self.tasks)) {
    return callback(new Error('Update what task? There is no existing task with that name'));
  }

  var task = self.tasks[taskid];
  
  TASK_FIELDS.forEach(key => {
    if (key in options) {
      task[key] = options[key];
    }
  })

  self.removeTaskTriggers(task.id);
  self.setupTaskTriggers(task);

  self.emit('task.update', task.id);

  callback(null, task);
};


/**
 * Delete a task
 *
 * @param  {String} tid       A Task id
 * @param {Function} callback
 */
Ummon.prototype.deleteTask = function(tid, callback){
  var self = this;

  self.removeTaskTriggers(tid);
  delete self.tasks[tid];

  self.emit('task.delete', tid);

  callback(null);
};


/**
 * Get all the current Run objects (whether in queue or workers)
 *
 * @return {[run]} An array of run objects
 */
Ummon.prototype.getRuns = function(){
  var self = this;
  var runs = [];

  for (var pid in self.workers){
    runs.push(self.workers[pid].run);
  }

  self.queue.items.forEach(run => {
    runs.push(run);
  });

  return runs;
};


Ummon.prototype.getRunningTaskIds = function() {
  var self = this;

  var workerIds = []
  for (var pid in self.workers) {
    if (workerIds.indexOf(self.workers[pid].run.task.id) === -1) {
      workerIds.push(self.workers[pid].run.task.id);
    }
  }
  return workerIds;
}


/**
 * The "Manual" trigger. Run an existing task or a one-off command.
 *
 * TODO Support batch manual runs via *, collection.*, and *.task?
 *
 * @param  {string}   task     The task or command to be run
 * @param  {Function} callback
 */
Ummon.prototype.runTask = function(task, callback){
  var self = this;
  var taskToRun;
  var tid = self.getTaskId(task);

  if (tid) {
    taskToRun = self.getTaskSync(tid);
  } else {
    // Mimic a task
    taskToRun = {
      id: task,
      collection: '_command',
      command: task,
      lastSuccessfulRun: null,
      recentExitCodes: []
    };
  }

  self.queue.push(taskToRun, 'manual', callback);
};


/**
 * Is Ummon ready to run a task?
 *
 * "Ready" is when the active workers is less than MAX_WORKERS
 * If ummon is paused, then ready will always return false
 *
 * @return {Boolean}
 */
Ummon.prototype.ready = function(){
  return !this.config.pause && (
    Object.keys(this.workers).length < this.MAX_WORKERS && this.queue.hasNext()
  );
};


/**
 * Run the next task in the queue if ummon is ready
 *
 * Check if ummon is ready, then create a new worker
 */
Ummon.prototype.createWorkerIfReady = function(){
  var self = this;

  if (self.ready()){
    var nextRun = self.queue.getNext(self.getRunningTaskIds())
    if (nextRun) {
      self.createWorker(nextRun);
    }
  }
};


/**
 * Create a new worker
 *
 * @param {Run} run   A run is shift'ed off of the queue and passed to a new Worker
 */
Ummon.prototype.createWorker = function(run){
  var self = this;

  var workerProcess = worker(run, self);

  self.workers[workerProcess.pid] = workerProcess;
};

// Helpers
function isCronTime(cronString) {
  return ((cronString[0] === '*' && cronString.length > 1) || !isNaN(cronString[0]));
}
