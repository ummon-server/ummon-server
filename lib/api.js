'use strict';

/*!
 * Module dependancies
 */
var fs = require('fs');
var cp = require('child_process')
var es = require('event-stream');
var _ = require('underscore');


module.exports = function(ummon){
  var api = {};
  

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
  api.getTasks= function(req, res, next){
    var collections = {'collections': {}};
    
    var collectionNames = (req.params.collection) 
      ? [req.params.collection] // Return as an array so we can keep an iterator below
      : _.uniq(_.pluck(ummon.tasks, 'collection'), true);
    
    collectionNames.forEach(function(collection){
      collections.collections[collection] = {
        defaults: ummon.defaults[collection],
        tasks: _.filter(ummon.tasks, function(task){ return task.collection === collection; })
      };
    });

    res.json(200, collections);
    return next();
  };


  api.getTask = function(req, res, next){
    var p = req.params;
    if (!ummon.tasks[p.taskid]) {
      res.json(404, "Task not found!");
      return next();
    }
    
    res.json(200, {"task": ummon.getTask(p.taskid) });
    return next();
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
    var task = ummon.createTask(req.body);

    res.json(200, {"message":"Task "+task.id+" successfully created", "task":task});
    return next();
  };

  
  api.updateTask = function(req, res, next){
    var p = req.params;
    var t = req.body;

    if (!ummon.tasks[p.taskid]) {
      res.json(404, "Task not found!");
    }

    var task = ummon.updateTask(t);

    res.json(200, {"message":"Task "+task.id+" successfully updated", "task":task});
    return next();
  };


  api.deleteTask = function(req, res, next){
    var p = req.params;

    if (!ummon.tasks[p.taskid]) {
      res.json(404, "Task not found!");
    }

    ummon.deleteTask(p.taskid);

    res.json(200, {"message":"Task "+p.taskid+" successfully deleted"});
    return next();
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


  api.run = function(req, res, next){};
  api.kill = function(req, res, next){};

  return api;
};