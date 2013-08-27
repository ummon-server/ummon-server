'use strict';

/*!
 * Module dependancies
 */
var fs = require('fs');
var restify = require('restify');
var cp = require('child_process')
var es = require('event-stream');
var _ = require('underscore');


module.exports = function(ummon){
  var api = {};


  api.doesCollectionExist = function(req, res, next) {
    var collection = req.params.collection
    if (!ummon.defaults[collection] || !_.any(ummon.tasks, function(task){ return (task.collection === collection) })) {
      return next(new restify.ResourceNotFoundError('No collection of name '+req.params.collection+' found'));
    } else {
      next();
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

    res.json(200, {
      "workers": ummon.workers,
      "queue": ummon.queue.items,
      "activeTimers": Object.keys(ummon.timers),
      "isPaused": ummon.config.pause,
      "maxWorkers": ummon.MAX_WORKERS,
      "collections": ummon.getCollections(),
      "totalTasks": _.size(ummon.tasks)
    });
    next();
  };


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
    ummon.getTasks(req.params.collection, function(err, collections){
      if (err) {
        return next(err);
      }
      res.json(200, { 'collections': collections } );
      next();
    });
  };


  api.getTask = function(req, res, next){
    var p = req.params;

    ummon.getTask(p.taskid, function(err, task){
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
        return next(new restify.ConflictError(err.message));
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
    var p = req.params;
    var t = req.body;

    var task = ummon.updateTask(t, function(err, task){
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

    res.json(200, { "message": "Task " + task.id + " enabled" });
    next();
  }


  api.disableTask = function(req, res, next) {
    ummon.tasks[req.params.taskid].enabled = false;
    ummon.removeTaskTriggers(req.params.taskid);

    res.json(200, { "message": "Task " + req.params.taskid + " disabled" });
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

    ummon.emit('task.updated'); // Task.updated because this effect existing tasks

    res.json(200, { 'message': message, "collection":  collection, "defaults": ummon.defaults[collection]} );
    next();
  }


  api.enableCollection = function(req, res, next) {
    var collection = req.params.collection;
    var tasksEnabled = [];

    if (ummon.config.collections[collection].enabled === true) {
      res.json(304, { "message": "Collection already enabled" })
      return next();
    }

    ummon.config.collections[collection].enabled = true;
    for (var task in ummon.tasks) {
      if (ummon.tasks[task].collection === collection) {
        ummon.setupTaskTriggers(ummon.tasks[task]);
        tasksEnabled.push(task);
      }
    }

    res.json(200, { "message":  "Collection " + collection + " successfully enabled", "tasksEnabled": tasksEnabled} );
    next();
  }


  api.disableCollection = function(req, res, next) {
    var collection = req.params.collection;
    var tasksDisabled = [];

    if (ummon.config.collections[collection].enabled === false) {
      res.json(304, { "message": "Collection already disabled" })
      return next();
    }

    ummon.config.collections[collection].enabled = false;
    for (var task in ummon.tasks) {
      if (ummon.tasks[task].collection === collection) {
        ummon.removeTaskTriggers(task);
        tasksDisabled.push(task);
      }
    }

    res.json(200, { "message":  "Collection " + collection + " successfully enabled", "tasksDisabled": tasksDisabled} );
    next();
  }


  api.showLog = function(req, res, next){
    delete req.params.lines; // Not sure why this is here but deleting it simplifies the code below

    var key = Object.keys(req.params)[0];
    var val = req.params[key];
    var lines = req.query.lines;
    var cmd;

    // We need to build a tail command like:
    //
    //    ep '"taskid":"cmmi.apply-feedback"' ummon.log | tail -n5
    if (key) {
      cmd = 'grep \'"' + key + '":"' + val + '"\' ' + ummon.config.log.path + ' | tail -n' + lines;
    } else {
      cmd = 'tail -n' + lines + ' ' + ummon.config.log.path;
    }
    var d = require('domain').create();
    d.on('error', function(er) {
      console.log(er.stack)
    })
    d.run(function() {
      es.child(cp.exec(cmd)).pipe(res);
    })

    return next();
  };


  // api.run = function(req, res, next){};
  // api.kill = function(req, res, next){};

  return api;
};
