'use strict';

var test = require("tap").test;
var moment = require("moment");
var async = require("async");

var ummon = require('..')({pause:true, autoSave:false});

test('Add an existing task to the queue', t => {
  t.plan(4);
  ummon.config.pause = true;

  ummon.on('queue.new', run => {
    t.ok(true, 'The queue.new emitter was emited'); //Should fire twice
  });

  ummon.createTask({"collection":"science", "name":"nye","command": "echo \"The science guy!\"" }, (err, task) => {
    ummon.runTask('science.nye', (err, run) => {
      t.notOk(err, 'There is no error when an existing task is manual run');
      t.equal(run.task.id, 'science.nye', 'A right task was loaded');
      t.equal(run.triggeredBy, 'manual', 'A run is marked as manual');
    });
  })
});


test('Run a command', t => {
  t.plan(2);
  // Run a one-off command
  ummon.runTask('echo hello', (err, run) => {
    t.notOk(err, 'There is no error when a one-off command is created');
    t.ok(run, 'There is a run when a one-off command is created');
  });
})


test('teardown', t => {
  setImmediate(() => {
    process.exit();
  });
  t.end();
});
