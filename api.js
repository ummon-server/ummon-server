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


  api.doesCollectionExist = function(req, res, next, collection) {
    if (!ummon.defaults[collection] || !_.any(ummon.tasks, function(task){ return (task.collection === collection) })) {
      return next(new restify.ResourceNotFoundError('No collection of name '+req.params.collection+' found'));
    } else {
      next();
    }
  };


  api.doesTaskExist = function(req, res, next, collection) {
    if (!(req.params.taskid in ummon.tasks)) {
      return next(new restify.ResourceNotFoundError('Task not found! Consider broadening your search to a collection'));
    } else {
      next();
    }
  };

  /**
   * Ummon Status
   */
  api.status = function(req, res, next) {
    res.json(200,'status');
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
  };

  api.getCollectionDefaults = function(req, res, next) {
    var collection = req.params.collection;
    res.json(200, { 'collection':  collection, "defaults": ummon.defaults[collection]} );
  }

  api.setCollectionDefaults = function(req, res, next) {
    var collection = req.params.collection;
    
    var message = (ummon.defaults[collection])
          ? 'Collection '+collection+' defaults successfully set'
          : 'Collection '+collection+' created and defaults set'

    ummon.defaults[collection] = req.body;

    ummon.emit('task.updated'); // Task.updated because this effect existing tasks

    res.json(200, { 'message': message, 'collection':  collection, "defaults": ummon.defaults[collection]} );
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


  api.showLog = function(req, res, next){
    var key = Object.keys(req.params)[0];
    var val = req.params[key];
    var lines = req.query.lines;
    var cmd;

    // We need to build a tail command like:
    //    grep '"taskid":"cmmi.apply-feedback"' ummon.log | tail -n5
    if (key) {
      cmd = 'grep \'"' + key + '":"' + val + '"\' ' + ummon.config.log.path + ' | tail -n' + lines;
    } else {
      cmd = 'tail -n' + lines + ' ' + ummon.config.log.path;
    }

    es.child(cp.exec(cmd)).pipe(res);

    return next();
  };


  // api.run = function(req, res, next){};
  // api.kill = function(req, res, next){};

  return api;
};
