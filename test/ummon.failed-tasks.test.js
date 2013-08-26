'use strict';

var test = require("tap").test;
var moment = require("moment");
var async = require("async");

var ummon = require('..')({autoSave:false});

test('Triggerer proper tasks on failure', function(t){
  t.plan(11)

  ummon.on('queue.new', function(run){
    t.ok(true, 'The queue.new emitter was emited');
    t.ok((run.task.name === 'goodbye' || run.task.name === 'runMeOnErrors'), 'The queue is added to goodbye or runMeOnErrors');
  });

  ummon.on('worker.complete', function(run){
    t.ok(run, 'The worker.complete event was emited'); // Emitted twice for both tasks
    t.ok((run.task.name === 'goodbye' || run.task.name === 'runMeOnErrors'), 'The completed tasks are goodbye and runMeOnErrors')
  });

  async.series([
    function(callback){ ummon.createTask({"name": "goodbye", "command": "echo goodbye && exit 1"},  callback)},
    function(callback){ ummon.createTask({ "name": "runMeOnErrors", "command": "echo adios;","trigger": { "afterFailed": 'goodbye' }}, callback) }
  ],
  function(err){
    t.ok(ummon.tasks['ummon.goodbye'], 'There is a goodbye task');
    t.ok(ummon.tasks['ummon.runMeOnErrors'], 'There is a runMeOnErrors task');
    console.log(ummon.dependencies['error'].state)
    t.equal(ummon.getTaskReferences('goodbye', 'error')[0], 'ummon.runMeOnErrors', 'ummon.runMeOnErrors is a dependent task for goodbye');
  });

  ummon.runTask('goodbye', function(q){})
})

test('teardown', function(t){
  setImmediate(function() {
    process.exit();
  });
  t.end();
});
