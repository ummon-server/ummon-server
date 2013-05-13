'use strict';

/**
 * Module dependencies.
 */
var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var bunyan = require('bunyan');
var mkdirp = require('mkdirp');
var domain = require('domain');
var DependencyGraph = require('dependency-foo');
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
    console.error('WORKER DOMAIN ERROR', er.stack);
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
    self.config.logging.path = path.resolve(self.config.logging.path);
    mkdirp.sync(path.dirname(self.config.logging.path));


    self.log = bunyan.createLogger({
      name: 'ummon',
      streams: [
        {
          level: 'info',
          stream: process.stdout, // log INFO and above to stdout
        },
        {
          level: self.config.logging.level,
          path: self.config.logging.path  // log ERROR and above to a file
        }
      ],
      serializers: bunyan.stdSerializers
    });

    self.tasks = {};
    self.timers = {};
    self.workers = {};
    self.dependencies = new DependencyGraph();
    self.queue = queue(self);
  });

  // Setup listeners
  self.dispatcher.on('queue.new', function(r){
    self.log.info("A task run (%s) was added to the queue", r.id);

    self.createWorkerIfReady();
  });
}

Ummon.prototype.doesTaskExist = function(name){
  return (Object.keys(this.tasks).indexOf(name) !== -1);
};

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
 *    ummon.createTask({ collection:'default', name:'sleep', command:'sleep 5'...});
 *
 *    ummon.createTask({ name:'sleep', command:'sleep 5'...});
 * 
 * @param  {Object} config       Task config object
 */
Ummon.prototype.createTask = function(config){
  var self = this;
  
  if (!config.name) {
    self.log.error(new Error('No task name provided for task: ' + config.command));
  }

  //TODO: Consider setups with only one collection. Should every task be prefixed?
  if (!config.collection) { config.collection = self.config.defaultCollection; }
  
  var id = config.collection + '.' + config.name;

  if (Object.keys(self.tasks).indexOf(id) !== -1) {
    self.log.error(new Error('A task with name "' + id + '"" already exists'));
  }

  self.tasks[id] = {
    id: id,
    name: config.name,
    collection: config.collection,
    
    cwd: config.cwd || null,
    command: config.command  || null
  };

  if (config.trigger) {
    self.tasks[id].trigger = config.trigger;
  }

  self.setupTaskDependancies(self.tasks[id]);

  self.createTimer(self.tasks[id]);

  return self.tasks[id];
};

/**
 * Determine and setup all of a tasks dependant tasks
 * 
 * @param  {Task} t 
 */
Ummon.prototype.setupTaskDependancies = function(t){
  var self = this;
  
  if (self.tasks[t.id].trigger.after) {
    var after = self.taskName(self.tasks[t.id].trigger.after);

    if (!self.doesTaskExist(after)) {
      self.log.error('Task trigger ' + after + ' does not exist');
    }
    self.dependencies.subject(t.id).dependOn(after);
  }

  // TODO: How should failed task dependancies be tracker? self.dependenciesFailed
  // if (self.tasks[name].trigger.afterFail) {
  //  
  // }  
};


/**
 * Remove all dependant relationships for a specific task
 * 
 * @param  {string} tid
 */
Ummon.prototype.removeTaskDependancies = function(tid){
  var self = this;

  // Remove dependant tasks
  var deps = self.dependencies.subject(tid).dependencies;
  for (var t = 0; t < deps.length; t++) {
    self.dependencies.subject(tid).drop(deps[t]);
  }
 
  // TODO: Check to see if there are any orphaned tasks
  // SEE: https://github.com/punkave/ummon/issues/28
};


/**
 * Create a timer using cronJob
 * 
 * @param  {Task} t
 */
Ummon.prototype.createTimer = function(t){
  var self = this;
  
  if (t.trigger.time) {
    var timer = new cronJob({
      cronTime: t.trigger.time,
      onTick: function() {
        self.queue.push(self.tasks[t.id]);
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
 * @return {Task}
 */
Ummon.prototype.showTask = function(tid){
  var self = this;
  
  return self.tasks[tid];
};


/**
 * Update an existing task
 *
 * This include any timers related to the task
 * 
 * @param  {Task} config   Config data
 * @return {Task}        The updated task
 */
Ummon.prototype.updateTask = function(t){
  var self = this;

  if (!t.id && t.name && t.collection) {
    t.id = t.collection + "." + t.name;
  }
  
  if (!self.tasks[t.id]) { throw new Error('Update what task? There is no existing task with that name'); }

  t = _.defaults(t, self.tasks[t.id]);

  self.tasks[t.id] = t;

  if (self.timers[t.id] !== typeof "undefined") {
    delete self.timers[t.id];
  }

  if (t.trigger.time) {
    self.createTimer(t);
  }
  
  self.removeTaskDependancies(t.id);
  self.setupTaskDependancies(t);

  return t;
};


/**
 * Delete a task
 * 
 * @param  {String} tid       A Task id
 * @return {Boolean}
 */
Ummon.prototype.deleteTask = function(tid){
  var self = this;

  delete self.timers[tid];
  delete self.tasks[tid];

  self.removeTaskDependancies(tid);

  return true;
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
Ummon.prototype.createWorker = function(r){
  var self = this;

  var workerProcess = worker(r, self);
  
  self.workers[workerProcess.pid] = workerProcess;

  self.dispatcher.once('worker.complete', function(exitCode){
    // Cleanup
    delete self.workers[workerProcess.pid];

    // Queue dependant tasks
    var refs = self.dependencies.subject(r.task.id).references;
    
    // If there is dependant tasks and the previous task was successfull, GO!
    if (refs.length && exitCode === 0) {
      for (var index = 0; index < refs.length; index++) {
        self.queue.push(self.tasks[refs[index]]);
      }
    }
  });
};