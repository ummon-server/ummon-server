'use strict';

var test = require("tap").test;
var moment = require("moment");
var async = require("async");

var ummon = require('..')({pause:true, autoSave:false});

test('Add an existing task to the queue', function(t){
  t.plan(4);
  ummon.config.pause = true;

  ummon.on('queue.new', function(run){
    t.ok(true, 'The queue.new emitter was emited'); //Should fire twice
  });

  ummon.createTask({"collection":"science", "name":"nye","command": "echo \"The science guy!\"" }, function(err, task){
    ummon.runTask('science.nye', function(err, run){
      t.notOk(err, 'There is no error when an existing task is manual run');
      t.equal(run.task.id, 'science.nye', 'A right task was loaded');
      t.equal(run.triggeredBy, 'manual', 'A run is marked as manual');
    });
  })
});


test('Run an arbitrary command', function(t){
  t.plan(2);
  // Run a new, arbitrary command
  ummon.runTask({'command':'echo hello'}, true, function(err, run){
    t.notOk(err, 'There is no error when an arbitrary task is created');
    t.ok(run, 'There is a run when an arbitrary task is created');
  });
})


test('teardown', function(t){
  setImmediate(function() {
    process.exit();
  });
  t.end();
});
