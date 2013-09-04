'use strict';

var test = require("tap").test;
var moment = require("moment");
var async = require("async");

var ummon = require('..')({pause:true, autoSave:false});

test('Create a tasks with a wildcard trigger', function(t) {
  t.plan(2);

  // Create a bunch of dummy tasks
  async.series([
    function(callback){ ummon.createTask({"collection":"important","name":"one","command": "echo one" }, callback); },
    function(callback){ ummon.createTask({"collection":"important","name":"two","command": "echo two"}, callback); },
    function(callback){ ummon.createTask({"collection":"notimportant","name":"one","command": "echo two"}, callback); },
    // Now the wildcard tasks
    function(callback){ ummon.createTask({"collection":"cleanup","name":"important","command": "echo two", "trigger":"important.*" }, callback); },
    function(callback){ ummon.createTask({"collection":"cleanup","name":"all","command": "echo two", "trigger":"*" }, callback); },
  ],
  function(err){
    console.log(ummon.getTaskReferences('important.one'))
    t.similar(ummon.getTaskReferences('important.one'), ['cleanup.important','cleanup.all'], 'important.one depends on all the tasks');
    t.similar(ummon.getTaskDependencies('cleanup.all'), ['important.one','important.two','notimportant.one', 'cleanup.important'], 'cleanup.all depends on all the tasks');
  });
});

test('teardown', function(t){
  setImmediate(function() {
    process.exit();
  });
  t.end();
});
