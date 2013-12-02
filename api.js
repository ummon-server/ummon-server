'use strict';

/*!
 * Module dependancies
 */
var fs = require('fs');
var restify = require('restify');
var cp = require('child_process')
var es = require('event-stream');
var _ = require('underscore');
var async = require('async');
var moment = require('moment');


module.exports = function(ummon){
  var api = {};


  api.doesCollectionExist = function(req, res, next) {
    var collection = req.params.collection

    if (collection && collection in ummon.config.collections) {
      next();
    } else {
      return next(new restify.ResourceNotFoundError('No collection of name '+collection+' found'));
    }
  };


  api.doesTaskExist = function(req, res, next) {
    if (!(req.params.taskid in ummon.tasks)) {
      return next(new restify.ResourceNotFoundError('Task not found! Consider broadening your search to a collection'));
    } else {
      next();
    }
  };

  /**
   * Return the configuration object
   */
  api.getConfig = function(req, res, next) {
    res.json(200, ummon.config);
    next();
  };


  /**
   * Update the configuration
   *
   * Currently limited to only top level of config. So
   * changing log.path won't work just yet
   */
  api.setConfig = function(req, res, next) {
    _.each(req.query, function(value, key) {
      // Convert strings for true and false to boolean
      if (value == "true" || value == "false") {
        value = (value == "true") ? true : false;

      } else if (!isNaN(value)) {
        value = +value;
      }

      ummon.config[key] = value;
    })

    res.json(200, ummon.config);
    next();
  };


  /**
   * What tasks are running
   */
  api.ps = function(req, res, next){
    var pids = Object.keys(ummon.workers);

    res.json(200, {
      "count":pids.length,
      "pids": pids,
      "runs": _.pluck(ummon.workers, 'run')
    });
    next();
  };


  /**
   * Get basic system info, for example:
   *
   *   {
   *     "ok": true,
   *     "version": "0.1.0",
   *     "name": "ummon.server",
   *     "port": 8888
   *   }
   */
  api.getInfo = function(req, res, next) {
    var pkg = require('./package.json');
    res.json(200, {
      ok: true,
      version: pkg.version,
      name: ummon.config.name,
      port: ummon.config.port
    });
  };

  /**
   * Return a snapshot of what is going on
   *
   * returns an object like:
   *
   *   {
   *     "workers": [...],
   *     "queue": [...],
   *     "activeTimers": 1,
   *     "isPaused": falase,
   *     "maxWorkers": 10,
   *     "collections": 2,
   *     "totalTasks":
   *   }
   */
  api.getStatus = function(req, res, next){
    var pids = Object.keys(ummon.workers);

    var workers = (_.size(ummon.workers))
      ? _.map(ummon.workers, function(worker) {return worker.run.task.id})
      : [];

    res.json(200, {
      "workers": workers,
      "queue": ummon.queue.getPresentTaskIds(),
      "activeTimers": Object.keys(ummon.timers),
      "isPaused": ummon.config.pause,
      "maxWorkers": ummon.MAX_WORKERS,
      "collections": ummon.getCollections(),
      "totalTasks": _.size(ummon.tasks)
    });
    next();
  };


  api.getQueue = function(req, res, next) {
    res.json(200, {"queue": ummon.queue.getPresentTaskIds()});
  }


  api.clearQueue = function(req, res, next) {
    var task = req.params.task || false;
    ummon.queue.clear(task);
    res.json(200)
  }


  /**
   * Get a number of tasks. Could be for a specific colleciton
   * or all configured tasks
   *
   * Returns:
   *   {
   *     'collectionName': {
   *       'defaults': { ...defaults... },
   *       'tasks': { ...tasks... }
   *     }
   *   }
   *
   * @param  {[type]}   req
   * @param  {[type]}   res
   * @param  {Function} next The callback
   * @return {[type]}        Heavily structured object. See above
   */
  api.getTasks = function(req, res, next) {
    var filter = req.params.collection || req.params.taskid || false;

    ummon.getTasks(filter, function(err, collections){
      if (err) {
        if (err.message === "There is no tasks or collections that match the provided filter") {
          return next(new restify.ResourceNotFoundError(err.message));
        } else {
          return next(err);
        }
      }
      res.json(200, { 'collections': collections } );
      next();
    });
  };


  api.getCollection = function (req, res, next) {
    ummon.getTasks(req.params.collection, function (err, results) {
      if (err) return next(err);
      // Collection object should always be the only member of the results array
      res.json(200, results[0]);
    });
  };


  api.getTask = function(req, res, next){
    ummon.getTask(req.params.taskid, function(err, task){
      if (err) {
        return next(err);
      }
      res.json(200, { 'task': task } );
      next();
    });
  };


  /**
   * PUT a collection
   *
   * @param {[type]}   req  [description]
   * @param {[type]}   res  [description]
   * @param {Function} next [description]
   */
  api.setTasks = function(req, res, next) {
    ummon.createCollectionAndTasks(req.body, function(err){
      if (err) {
        // Assume it's a duplicate task id error
        return next(new restify.InvalidContentError(err.message));
      }

      ummon.getTasks(req.params.collection, function(err, collection){
        res.json(200, { 'collections': collection } );
        next();
      })
    });
  };


  /**
   * Create a task and add it to a collection
   *
   * Accepts:
   *
   *     {
   *        "name":"hello",
   *        "command": "echo Hello;",
   *        "trigger": {
   *          "time": "* * * * *"
   *        }
   *      }
   */
  api.createTask = function(req, res, next){
    var task = ummon.createTask(req.body, function(err, task){
      if (err) {
        // Assume it's a duplicate task id error
        return next(new restify.ConflictError(err.message));
      }

      res.json(200, {"message":"Task "+task.id+" successfully created", "task":task});
      next();
    });
  };


  api.updateTask = function(req, res, next){
    var task = ummon.updateTask(req.params.taskid, req.body, function(err, task){
      res.json(200, {"message":"Task "+task.id+" successfully updated", "task":task});
      next();
    });
  };


  api.deleteTask = function(req, res, next){
    var p = req.params;

    ummon.deleteTask(p.taskid, function(err){
      if (err) {
        return next(err);
      }

      res.json(200, {"message":"Task "+p.taskid+" successfully deleted"});
      next();
    });
  };


  api.enableTask = function(req, res, next) {
    var task = ummon.tasks[req.params.taskid];

    // Don't enable a task that is in a disabled collection
    if (ummon.config.collections[task.collection].enabled === false) {
      res.json(424, { "message":  "Cannot enabled task " + task.id + " because it's collection is disabled. Please enable collection "+task.collection} );
      return next();
    }

    task.enabled = true;
    ummon.setupTaskTriggers(task);

    ummon.emit('task.updated', task.id); // Task.updated because this effect existing tasks

    res.json(200, { "message": "Task " + task.id + " enabled" });
    next();
  }


  api.disableTask = function(req, res, next) {
    var taskid = req.params.taskid;

    ummon.tasks[taskid].enabled = false;
    ummon.removeTaskTriggers(taskid);

    ummon.emit('task.updated', taskid); // Task.updated because this effect existing tasks

    res.json(200, { "message": "Task " + taskid + " disabled" });
    next();
  }


  api.getCollectionDefaults = function(req, res, next) {
    var collection = req.params.collection;
    res.json(200, { "collection":  collection, "defaults": ummon.defaults[collection]} );
    next();
  }


  api.setCollectionDefaults = function(req, res, next) {
    var collection = req.params.collection;

    var message = (ummon.defaults[collection])
          ? 'Collection '+collection+' defaults successfully set'
          : 'Collection '+collection+' created and defaults set'

    ummon.defaults[collection] = req.body;

    ummon.emit('task.updated', collection); // Task.updated because this effect existing tasks

    res.json(200, { 'message': message, "collection":  collection, "defaults": ummon.defaults[collection]} );
    next();
  }


  api.enableCollection = function(req, res, next) {
    var collection = req.params.collection;
    var tasksEnabled = [];

    if (ummon.config.collections[collection].enabled === true) {
      res.json(304)
      return next();
    }

    ummon.config.collections[collection].enabled = true;
    for (var task in ummon.tasks) {
      if (ummon.tasks[task].collection === collection) {
        ummon.setupTaskTriggers(ummon.tasks[task]);
        tasksEnabled.push(task);
      }
    }

    ummon.emit('task.updated', collection); // Task.updated because this effect existing tasks

    res.json(200, { "message":  "Collection " + collection + " successfully enabled", "tasksEnabled": tasksEnabled} );
    next();
  }


  api.disableCollection = function(req, res, next) {
    var collection = req.params.collection;
    var tasksDisabled = [];

    if (ummon.config.collections[collection].enabled === false) {
      res.json(304)
      return next();
    }

    ummon.config.collections[collection].enabled = false;
    for (var task in ummon.tasks) {
      if (ummon.tasks[task].collection === collection) {
        ummon.removeTaskTriggers(task);
        tasksDisabled.push(task);
      }
    }

    ummon.emit('task.updated', collection); // Task.updated because this effect existing tasks

    res.json(200, { "message":  "Collection " + collection + " successfully disabled", "tasksDisabled": tasksDisabled} );
    next();
  }


  api.deleteCollection = function(req, res, next) {
    var collection = req.params.collection;

    delete ummon.config.collections[collection];
    delete ummon.defaults[collection];

    var collectionDbPath = ummon.config.tasksPath + '/' + collection + '.tasks.json';
    if (fs.existsSync(collectionDbPath)) {
      fs.unlinkSync(collectionDbPath)
    }

    var taskIds = ummon.getTaskIds(collection+'*');

    async.each(taskIds, ummon.deleteTask.bind(ummon), function(err){
      ummon.emit('task.deleted', collection); // Task.updated because this effect existing tasks

      res.json(200, { "message":  "Collection " + collection + " successfully deleted" } );
      next();
    });
  }


  api.showLog = function(req, res, next){
    delete req.params.lines; // Not sure why this is here but deleting it simplifies the code below

    var filter = req.query.filter || false;
    var from = req.query.from || false;
    var to = req.query.to || false;
    var runsOnly = (req.query.runsOnly) ? true : false;
    var follow = (req.query.follow) ? true : false;

    // Figure out the filter
    if (filter) {
      var runid = false, collection = false, taskid = false;
      if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(filter)) {
        runid = filter;
      } else if (filter.indexOf('.') !== -1) {
        taskid = filter;
      } else {
        collection = filter;
      }
    }

    var d = require('domain').create();

    d.on('error', function(er) {
      console.log(er.stack)
    })

    d.run(function() {
      es.pipeline(
        fs.createReadStream(ummon.config.log.path, {encoding: 'utf8'}),
        es.split(), // Split on new lines
        es.parse(), // JSON.parse()

        // Start by filtering by date
        es.map(function (data, callback) {
          if ((!from || data.time >= from) && (!to || data.time <= to)) {
            return callback(null, data)
          }
          callback()
        }),

        // Filter on content
        es.map(function (data, callback) {
          if (runid || taskid || collection) {
            if ((runid && runid === data.runid) ||
              (taskid && taskid === data.taskid) ||
              (collection && collection === data.collection)) {
                return callback(null, data)
            }

            return callback()
          }

          callback(null, data);
        }),

        // filter on runs only
        es.map(function (data, callback) {
          if (runsOnly) {
            if (("run" in data)) {
              return callback(null, data)
            } else {
              return callback();
            }
          }
          callback(null, data)
        }),
        es.stringify(), // JSON.stringify()
        res
      )
    })

    return next();
  };


  // api.run = function(req, res, next){

  // };
  // api.kill = function(req, res, next){};

  return api;
};
