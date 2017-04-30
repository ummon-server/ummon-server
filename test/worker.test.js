'use strict';

var test = require("tap").test;

var ummon = require('..')({pause:true, autoSave:false, tasksPath:null});
var worker = require('../lib/worker.js');
var run = require('../lib/run.js');


//                Add a task to the list!
// - - - - - - - - - - - - - - - - - - - - - - - - - 
// 
var sampleTask = run({
  "command": "echo $TERM Finished",
  "env": {"TERM":"dumb"}
});
 
test('Test successfully running code with a worker', t => {
  t.plan(2);

  var sleep = worker(sampleTask, ummon);

  t.type(sleep.pid, "number", 'There is a pid that is a number');

  ummon.once('worker.complete', run => {
    t.equal(run.exitCode, 0, 'The task runs and returns it\'s exit code of 0');
    t.end();
  });
});


// The test doesn't exit because of something the worker is doing. 
test('teardown', t => {
  setImmediate(() => {
    process.exit();
  });
  t.end();
});