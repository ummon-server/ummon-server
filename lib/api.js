'use strict';

/*!
 * Module dependancies
 */
var fs = require('fs');
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


  api.getTasks= function(req, res, next){
    res.json(200, _.values(ummon.tasks) );
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
    var p = req.params;
    var key = Object.keys(p)[0];
    var val = p[key];

    es.pipeline(
      fs.createReadStream(ummon.config.log.path, {flags: 'r', encoding: 'utf-8'}),
      es.split(),
      es.parse(),
      es.mapSync(function (data) {
        if (key) {
          if (data[key] && data[key] === val) {
            return data;
          }
        } else {
          return data;
        }
      }),
      es.stringify(),
      res
    );
    return next();
  };


  api.streamLog = function(req, res, next){};
  api.run = function(req, res, next){};
  api.kill = function(req, res, next){};

  return api;
};