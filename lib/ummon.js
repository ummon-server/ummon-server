'use strict';

/**
 * Module dependencies.
 */
var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var bunyan = require('bunyan');
var mkdirp = require('mkdirp');
var glob = require("glob");
var domain = require('domain');
var DependencyGraph = require('dependency-foo');
var async = require('async');
var cronJob = require('cron').CronJob;
var EventEmitter2 = require('eventemitter2').EventEmitter2;
    
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
 * Ummon constructor
 * 
 * @param {object} options configuration options
 */
function Ummon(options){
  var self = this;

  var d = domain.create();
  
  d.on('error', function(er) {
    console.error('UMMON CONSTRUCTOR DOMAIN ERROR', er.stack);
    process.exit(1);
  });

  d.run(function() {
    if (!options) { options = {}; }

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
  
    self.poll = setInterval(function(){ self.createWorkerIfReady() }, '1000');
    // Setup listeners
    self.dispatcher.on('queue.new', function(r){
      self.log.info({event: 'queue.new', runid:r.id, taskid: r.task.id, collection: r.task.collection}, "A task run (%s) was added to the queue", r.id);

      self.createWorkerIfReady();
    });

    self.dispatcher.on('worker.complete', function(completedRun){
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
  });

  // Automatically load tasks from a config file
  if (self.config.tasksDir) {
    self.autoLoadTasks(function(err){
      if (err) {
        self.log.error(err);
      }
    });
  }
}


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
 * Load tasks out of a config file. This is a mess. Sorry
 */
Ummon.prototype.autoLoadTasks = function(callback){
  var self = this;

  glob(self.config.tasksDir + '*.json', function (err, files) {
    if (err || !files.length) {
      err = err || "No task config files were found";
      return callback(err);
    }

    self.log.info("Autoloading Tasks");
    async.each(files, self.loadCollectionFromFile.bind(self), function(err){
      callback(err);
    });
  });
};


Ummon.prototype.loadCollectionFromFile = function(file, callback) {
  var self = this;
  var config;

  try {
    config = require(path.resolve(file));
  } catch(e) {
    return callback(e);
  }

  var keys = Object.keys(config);
  if (keys.indexOf('name') !== -1 || keys.indexOf('tasks') !== -1) {
    return callback(new Error('Malformed tasks config file'));
  }

  // We need to bring the keys into the object
  _.each(config, function(collection, name){
    config[name].collection = name;
  });
  
  config = _.toArray(config);
  
  async.each(config, self.createCollectionAndTasks.bind(self), function(err){
    callback(err, true);
  });
};


/**
 * Setup a collection and it's associated tasks
 *
 * @see  autoLoadTasks
 * @param  {String}   collection The collection name
 * @param  {Object}   config     Config object from json object
 * @param  {Function} callback   The callback. Simply returns true if all goes well
 */
Ummon.prototype.createCollectionAndTasks = function(config, callback){
  var self = this;

  // Setup the defaults for this collection
  self.defaults[config.collection] = config.defaults;

  // Bring keys into the object. This simplifies the async forEach below
  // This feels gross
  for (var task in config.tasks){
    config.tasks[task].name = task;
    config.tasks[task].collection = config.collection;
  }

  config.tasks = _.toArray(config.tasks);

  async.each(config.tasks, self.createTask.bind(self), function(err){
    if (err) { return callback(err); }
    // Create manually defined sequences
    if (config.sequences) {
      config.sequences.forEach(function(sequence){
        var dependent = sequence.shift();
        if (dependent.indexOf('.')) { dependent = config.collection + '.' + dependent; }
        
        sequence.forEach(function(step){
          if (step.indexOf('.')) { step = config.collection + '.' + step; }
          
          self.dependencies.subject(step).dependOn(dependent);
          dependent = step;
        });
      });
    }

    callback(null, true);
  });
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
    
    cwd: config.cwd || null,
    command: config.command  || null,
    trigger: {}
  };

  if (config.trigger) {
    self.tasks[id].trigger = config.trigger;

    self.setupTaskdependencies(self.tasks[id]);
    self.createTimer(self.tasks[id]);
  }

  self.getTask(id, callback)
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
 * @param {function} callback
 */
Ummon.prototype.getTaskSync = function(tid, callback){
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
Ummon.prototype.getTasks = function(callback){
  var self = this;
  var tasks = [];

  for (var tid in self.tasks){
    tasks.push(self.getTaskSync(tid));
  }

  async.map(self.tasks, ummon.getTask, function(err, tasks){
    tasks =  _.groupBy(tasks, 'collection');
    callback(err, tasks);
  });
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

  callback(null, true);
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
  return (Object.keys(this.workers).length < this.MAX_WORKERS && this.queue.hasNext());
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