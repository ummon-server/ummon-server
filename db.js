// Though this is called db.js, right now the db is json files

'use strict';

/*!
 * Module dependancies
 */
var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var glob = require('glob');
var async = require('async');
var mkdirp = require('mkdirp');


module.exports = function(ummon) {
  var db = {};

  /**
   * Load tasks out of a config file. This is a mess. Sorry
   */
  db.loadTasks = function(callback) {
    var self = this;

    glob(ummon.config.tasksDir + '*.json', function (err, files) {
      if (err || !files) {
        return callback(err);
      }

      ummon.log.info("Load tasks from %s", ummon.config.tasksDir);
      async.each(files, self.loadCollectionFromFile.bind(self), function(err){
        callback(err);
      });
    });
  };


  db.loadCollectionFromFile = function(file, callback) {
    var self = this;
    var config;

    try {
      config = require(path.resolve(file));
    } catch(e) {
      return callback(e);
    }
    
    var keys = Object.keys(config);

    // Is there no 'collection' and 'name' keys? No 'tasks'? Then something is up.
    if (keys.indexOf('collection') === -1 || keys.indexOf('tasks') === -1) {
      return callback(new Error('Malformed tasks config file'));
    }

    self.createCollectionAndTasks(config, function(err){
      callback(err);
    });
  };


  /**
   * Setup a collection and it's associated tasks
   *
   * @see  autoLoadTasks
   * @param  {Object}   config     Config object from json object
   * @param  {Function} callback   The callback. Simply returns true if all goes well
   */
  
  db.createCollectionAndTasks = function(config, callback) {
    var self = this;

    // Setup the defaults for this collection
    ummon.defaults[config.collection] = config.defaults;

    // Bring keys into the object. This simplifies the async forEach below
    // This feels gross
    for (var task in config.tasks){
      config.tasks[task].name = task;
      config.tasks[task].collection = config.collection;
    }

    config.tasks = _.toArray(config.tasks);

    async.each(config.tasks, ummon.createTask.bind(ummon), function(err){
      if (err) { return callback(err); }
      // Create manually defined sequences
      if (config.sequences) {
        config.sequences.forEach(function(sequence){
          var dependent = sequence.shift();
          if (dependent.indexOf('.')) { dependent = config.collection + '.' + dependent; }
          
          sequence.forEach(function(step){
            if (step.indexOf('.')) { step = config.collection + '.' + step; }
            
            ummon.tasks[step].trigger.after = dependent; // Save trigger info in task
            
            ummon.dependencies.subject(step).dependOn(dependent); // Step DAG graph
            
            dependent = step;
          });
        });
      }

      callback();
    });
  };


  db.saveTasks = function(callback) {
    var collections = ummon.getCollections();

    if (!fs.existsSync(ummon.config.tasksDir)) {
      mkdirp.sync(ummon.config.tasksDir);
    }

    // Keep track of the last save time
    ummon.lastSave = new Date().getTime();

    async.each(collections, db.saveCollection, callback);
  };


  db.saveCollection = function(collection, callback) {
    ummon.getTasks(collection, function(err, result){
      if (err) {
        return callback(err);
      }
      
      fs.writeFile(ummon.config.tasksDir+'/'+collection+'.tasks.json', JSON.stringify(result[0], null, 2), function (err) {
        callback(err);
      });
    });
  };

  return db;
};