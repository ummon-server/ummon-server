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


module.exports = ummon => {
  var db = {};

  /**
   * Load tasks out of a config file. This is a mess. Sorry
   */
  db.loadTasks = function(callback) {
    var self = this;
    glob(ummon.config.tasksPath + '*.json', (err, files) => {
      if (err || !files) {
        return callback(err);
      }

      ummon.log.info("Load tasks from %s", ummon.config.tasksPath);
      async.each(files, self.loadCollectionFromFile.bind(self), err => {
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

    ummon.createCollectionAndTasks(config, err => {
      callback(err);
    });
  };


  db.saveTasks = callback => {
    if (ummon.config.tasksPath) {
      var collections = ummon.getCollections();

      if (!fs.existsSync(ummon.config.tasksPath)) {
        mkdirp.sync(ummon.config.tasksPath);
      }

      // Keep track of the last save time
      ummon.lastSave = new Date().getTime();
      ummon.log.info("Saving "+collections.length+" collection(s) to file", collections)
      async.each(collections, db.saveCollection, callback);
    }
  };


  /**
   * Remove data from tasks object that is not neccesary for the saved json file
   *
   * @param  {[type]} collection [description]
   * @return {[type]}            [description]
   */
  db.cleanCollectionMetaData = collection => {
    // This is gross but deep clone code feels gross too
    // TODO: Steam the json to the file and modify the stream
    collection = JSON.stringify(collection);
    collection = JSON.parse(collection);
    for (var index = 0; index < collection.length; index++) {
      for (var task in collection[index].tasks) {
        // Clean up duplicate data we don't need for this
        ['id', 'name', 'collection', 'recentExitCodes'].forEach(key => {
          delete collection[index].tasks[task][key]
        });
      }
    };

    return collection;
  };

  db.saveCollection = (collection, callback) => {
    ummon.getTasks(collection, (err, result) => {
      if (err) {
        return callback(err);
      }

      result = db.cleanCollectionMetaData(result);

      var resultStringified = JSON.stringify(result[0], null, '\t');

      fs.writeFile(ummon.config.tasksPath+'/'+collection+'.tasks.json', resultStringified, err => {
        callback(err);
      });
    });
  };

  return db;
};
