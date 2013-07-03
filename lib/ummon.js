'use strict';

/**
 * Module dependencies.
 */
var fs = require('fs');
var path = require('path');
var util = require('util');
var _ = require('underscore');
var bunyan = require('bunyan');
var mkdirp = require('mkdirp');
var domain = require('domain');
var DependencyGraph = require('dependency-foo');
// var async = require('async');
var cronJob = require('cron').CronJob;
var EventEmitter2 = require('eventemitter2').EventEmitter2;
    
var queue = require('./queue');
var worker = require('./worker');
var db = require('../db');


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
  
  d.on('error', function(er) {
    console.error('UMMON CONSTRUCTOR DOMAIN ERROR', er.stack);
    process.exit(1);
  });

  d.run(function() {
    if (!options) { options = {}; }

    // Load config
    var defaults = require(path.join(__dirname, '../config/config.defaults.json')); // Load config.defaults.json
    var config = {};
    
    if (options.configPath) {
      var configPath = path.normalize(options.configPath); // Get the full path to the current themes _config.json
      config = (fs.existsSync(configPath)) ? require(configPath) : {};
    }

    self.config = _.extend(defaults, config, options);
    
    // Cleanup paths and make any folders that need to be made
    self.config.log.path = path.resolve(self.config.log.path);
    mkdirp.sync(path.dirname(self.config.log.path));


    self.log = bunyan.createLogger({
      name: 'ummon',
      streams: [
        {
          level: 'debug',
          stream: process.stdout, // log INFO and above to stdout
        },
        {
          level: self.config.log.level,
          path: self.config.log.path  // log ERROR and above to a file
        }
      ],
      serializers: bunyan.stdSerializers
    });

    self.defaults = {};
    self.tasks = {};
    self.timers = {};
    self.workers = {};
    self.dependencies = new DependencyGraph();
    self.queue = queue(self);

    self.MAX_WORKERS = 5;
    self.pause = false;
  });
  
  // Check if there is a task in the queue that can be run. See config.createWorkerPollInterval
  self.poll = setInterval(function(){ self.createWorkerIfReady() }, self.config.createWorkerPollInterval);

  // This could be in the constructor it just felt cleaner in another place
  self.setupListeners();

  // Setup the "database"
  db = db(self);
  
  // Automatically load tasks from a config file
  if (self.config.tasksDir) {
    db.loadTasks(function(err){
      if (err) {
        self.log.error(err);
      }
      // Don't setup lastSave until the initial load is done
      // This way, it's not saving over itself when its trying
      // to load
      self.lastSave = null;
    });
  }
}


Ummon.prototype.setupListeners = function() {
  var self = this;

  // Anytime a task is changed (new, update, delete) save the tasks to files
  self.on('task.*', function(){
    // If there has been a save, and more than the minimal save interval has passed, save again!
    if (self.lastSave && (new Date().getTime() - self.lastSave ) > self.config.minimalSaveInterval) {
      self.log.info("Saving tasks to file");
      db.saveTasks();
    }
  });


  // Everytime something is added the queue, log it and try to create a worker
  self.on('queue.new', function(r){
    self.log.info({event: 'queue.new', runid:r.id, taskid: r.task.id, collection: r.task.collection}, "A task run (%s) was added to the queue", r.id);

    self.createWorkerIfReady();
  });


  // If a worker completes: Delete the worker & run dependent tasks
  self.on('worker.complete', function(completedRun){
    // Cleanup
    delete self.workers[completedRun.pid];

    // Queue dependent tasks
    if (completedRun.task.id) {
      var refs = self.dependencies.subject(completedRun.task.id).references;
      
      // If there is dependent tasks and the previous task was successfull, GO!
      if (refs.length && completedRun.exitCode === 0) {
        for (var index = 0; index < refs.length; index++) {
          self.log.debug('Task run for %s triggered new run for %s', completedRun.task.id, refs[index]);
          self.queue.push(self.getTaskSync(refs[index]), completedRun);
        }
      }
    }
  });
};


/**
 * Is a task in process?
 *
 * Check the queue and current workers
 * 
 * @param  {string} id a task name
 * @return {boolean}
 */
Ummon.prototype.isTaskInProcess = function(id){
  var self = this;
  // TODO: This is gross. Can it efficiently be combined with getRuns? or is
  // this a sign it's poorly designed
  var queue = _.some(self.queue.items, function(item){ return (item.task.id === id); });
  var workers = _.some(self.workers, function(worker){ return (worker.run.task.id === id); });

  return (queue || workers);
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

  self.queue.items.forEach(function(run){
    runs.push(run);
  });
  
  console.log("Runs: %s",_.size(runs));
  return runs;
};


/**
 * Does a task exist?
 * 
 * @param  {string} name a task name
 * @return {boolean}
 */
Ummon.prototype.doesTaskExist = function(name){
  return (Object.keys(this.tasks).indexOf(name) !== -1);
};


/**
 * Return a proper task name. ie: allow the user to only
 * pass a task name, like doThisThing and it will auto
 * append the default collection name for you
 * 
 * @param  {string} name
 * @return {string}     
 */
Ummon.prototype.taskName = function(name){
  if (name.indexOf('.') === -1) { 
    return this.config.defaultCollection+'.'+name;
  } else {
    return name;
  }
};


/**
 * Add task to a specified collection
 *
 * This is a shorthand function which passes through to the specified collection
 *
 * Example:
 *
 *    ummon.createTask({ collection:'default', name:'sleep', command:'sleep 5'...}, function(err, task){});
 *
 *    ummon.createTask({ name:'sleep', command:'sleep 5'...}, function(err, task){});
 * 
 * @param  {Object} config       Task config object
 * @param {function} callback   Return the full task object (including defaults)
 */
Ummon.prototype.createTask = function(config, callback){
  var self = this;

  if (!config.command){
    return callback(new Error('No command provided! Please provide one'));
  }

  if (!config.name){
    return callback(new Error('No task name provided for task: ' + config.command));
  }

  if (!config.collection) {
    config.collection = self.config.defaultCollection;
  }
  
  var id = config.collection + '.' + config.name;

  if (Object.keys(self.tasks).indexOf(id) !== -1) {
    return callback(new Error('A task with name "' + id + '"" already exists')) ;
  }

  self.log.info("Creating task "+id);

  self.tasks[id] = {
    id: id,
    name: config.name,
    collection: config.collection,
    command: config.command,
    trigger: {}
  };

  if (config.cwd) { self.tasks[id].cwd = config.cwd; }

  if (config.trigger) {
    self.tasks[id].trigger = config.trigger;

    self.setupTaskdependencies(self.tasks[id]);
    self.createTimer(self.tasks[id]);
  }

  self.emit('task.new');
  // self.getTask(id, callback);
  callback(null, self.tasks[id]);
};


/**
 * Determine and setup all of a tasks dependent tasks
 * 
 * @param  {Task} t 
 */
Ummon.prototype.setupTaskdependencies = function(t){
  var self = this;

  if (self.tasks[t.id].trigger.after) {
    var after = self.taskName(self.tasks[t.id].trigger.after);

    if (!self.doesTaskExist(after)) {
      console.log("SELF DESK TASK KEXITS");
      self.log.error('Task trigger ' + after + ' does not exist');
    }
    self.dependencies.subject(t.id).dependOn(after);
  }

  // TODO: How should failed task dependencies be tracker? self.dependenciesFailed
  // https://github.com/punkave/ummon-server/issues/10
  // if (self.tasks[name].trigger.afterFail) {
  //  
  // }  
};


/**
 * Remove all dependent relationships for a specific task
 * 
 * @param  {string} tid
 */
Ummon.prototype.removeTaskdependencies = function(tid){
  var self = this;

  // Remove dependent tasks
  var deps = self.dependencies.subject(tid).dependencies;
  for (var t = 0; t < deps.length; t++) {
    self.dependencies.subject(tid).drop(deps[t]);
  }
};


/**
 * Create a timer using cronJob
 * 
 * @param  {Task} t
 */
Ummon.prototype.createTimer = function(t){
  var self = this;
  
  if (t.trigger.time) {
    self.log.info('Setting up timed trigger for '+t.id);
    var timer = new cronJob({
      cronTime: t.trigger.time,
      onTick: function() {
        // Add the task to the queue if it isn't already in process
        if (!self.isTaskInProcess(t.id)){
          self.queue.push(self.getTaskSync(t.id), 'timer');
        } else {
          self.log.warn('Task %s is already in process and is being skipped', t.id);
        }
      },
      start: true
    });

    // Keep track of all the timers
    self.timers[t.id] = timer;
  }
};


/**
 * Return an array of all of the collection names
 * 
 * @return {Array} All collection names
 */
Ummon.prototype.getCollections = function(){
  var self = this;
  
  return _.uniq(_.pluck(self.tasks, 'collection'), true);
};


/**
 * Show the details for a particular task
 * 
 * @param  {String} tid       A Task id
 * @param {function} callback
 */
Ummon.prototype.getTask = function(tid, callback){
  var self = this;
  var task = self.tasks[tid];

  if (!task) {
    return callback(new Error("There is no task with the id of %s", tid));
  }

  // TODO: Create a getDefaults method
  if (self.defaults[task.collection]){
    task = _.defaults(task, self.defaults[task.collection]);
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
  var task = self.tasks[tid];
  if (task) {
    // TODO: Create a getDefaults method
    if (self.defaults[task.collection]){
      task = _.defaults(task, self.defaults[task.collection]);
    }
  } else {
    task = false;
  }

  return task;
};


/**
 * Get many tasks
 * 
 * @param  {Function} callback
 */
Ummon.prototype.getTasks = function(collection, callback){
  var self = this;
  
  var tasks = [];
  var collections = [];
  
  // Figure out which collections to get
  var collectionNames = (collection) 
    ? [collection] // Return as an array so we can keep an iterator below
    : self.getCollections();

  // Loop through each desired collection and create its object
  collectionNames.forEach(function(collection){
    var collectionTasks = {};

    _.each(self.tasks, function(task){
      if (task.collection === collection) {
        var name = task.name;
        
        // Clean up duplicate data we don't need for this
        ['id', 'name', 'collection'].forEach(function(key){
          delete task[key];
        });

        collectionTasks[name] = task;
      }
    });

    collections.push({
      collection: collection,
      defaults: self.defaults[collection],
      tasks: collectionTasks
    });

  });

  callback(null, collections);
 };


/**
 * Update an existing task
 *
 * This include any timers related to the task
 * 
 * @param  {Task} config   Config data
 * @param {Function}    callback
 */
Ummon.prototype.updateTask = function(t, callback){
  var self = this;

  if (!t.id && t.name && t.collection) {
    t.id = t.collection + "." + t.name;
  }
  
  if (!self.tasks[t.id]) { 
    return callback(new Error('Update what task? There is no existing task with that name')); 
  }

  t = _.defaults(t, self.tasks[t.id]);

  self.tasks[t.id] = t;

  if (self.timers[t.id] !== typeof "undefined") {
    delete self.timers[t.id];
  }

  if (t.trigger.time) {
    self.createTimer(t);
  }
  
  self.removeTaskdependencies(t.id);
  self.setupTaskdependencies(t);

  self.emit('task.update');

  callback(null, t);
};


/**
 * Delete a task
 * 
 * @param  {String} tid       A Task id
 * @param {Function} callback
 */
Ummon.prototype.deleteTask = function(tid, callback){
  var self = this;

  delete self.timers[tid];
  delete self.tasks[tid];

  self.removeTaskdependencies(tid);

  self.emit('task.delete');

  callback(null);
};


/**
 * The "Manual" trigger. Run an existing task or any arbitray command
 *
 * Task can be an object: {command:'echo "meat!"'}. All arbitrary commands
 * such as this require `force` to be true
 * 
 * @param  {string|object}   task     The task to be run
 * @param  {boolean}   force    Optional, defaults to false. 
 * @param  {Function} callback 
 */
Ummon.prototype.runTask = function(task, force, callback){
  var self = this;

  var taskToRun = {};

  if ('function' === typeof force && !callback) {
    callback = force;
    force = false;
  }

  if ('string' === typeof task) {
    if (self.dependencies.subject(task).dependencies.length > 0 && !force) {
      return callback(new Error('The task '+task+' has a dependent task. Call that instead'));
    }

    if (!self.doesTaskExist(task)) {
      return callback(new Error('The task name '+task+' does not exist'));
    }

    taskToRun = self.getTaskSync(task);
  }

  if ('object' === typeof task ) {
    if (!force) {
      return callback(new Error('You must force all arbitrary tasks. Saftey first!'));
    }
    taskToRun = task;
  }

  self.queue.push(taskToRun, 'manual', callback);
};

/**
 * Is Ummon ready to run a task? 
 *
 * ready = workers.length < MAX_WORKERS
 */
Ummon.prototype.ready = function(){
  return !this.pause && (Object.keys(this.workers).length < this.MAX_WORKERS && this.queue.hasNext());
};


/**
 * Run the next task in the queue if ummon is ready
 */
Ummon.prototype.createWorkerIfReady = function(){
  var self = this;

  if (self.ready()){
    self.createWorker(self.queue.getNext());
  }
};


/**
 * Run a task!
 */
Ummon.prototype.createWorker = function(run){
  var self = this;

  var workerProcess = worker(run, self);
  
  self.workers[workerProcess.pid] = workerProcess;
};