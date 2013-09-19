'use strict';

var test = require("tap").test;
var moment = require("moment");
var async = require("async");

var ummon = require('..')({pause:true, autoSave:false});

test('Create a tasks with simplified trigger', function(t) {
  t.plan(8);

  ummon.createTask({
    "name":"everyminute",
    "command": "echo Hello;",
    "trigger": "* 5 * * *"
  }, function(err, task){
    t.ok(task, 'The callback returns a task');
    t.ok(ummon.tasks['ummon.everyminute'], 'There is a everyminute task');
    t.ok(ummon.tasks['ummon.everyminute'].trigger.time, 'There is a timed trigger');
    t.ok(ummon.timers['ummon.everyminute'], 'There is a everyminute task timer');
  });

  ummon.createTask({
    "name":"aftereveryminute",
    "command": "echo Hello;",
    "trigger": "everyminute"
  }, function(err, task){
    t.ok(task, 'The callback returns a task');
    t.ok(ummon.tasks['ummon.aftereveryminute'], 'There is a aftereveryminute task');
    t.ok(ummon.tasks['ummon.aftereveryminute'].trigger.after, 'There is a trigger');
    t.equal(ummon.getTaskReferences('ummon.everyminute')[0], 'ummon.aftereveryminute', 'aftereveryminute is dependent on everyminute');
  });

});


test('teardown', function(t){
  setImmediate(function() {
    process.exit();
  });
  t.end();
});
