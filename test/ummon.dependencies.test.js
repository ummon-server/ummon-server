'use strict';

var test = require("tap").test;
var moment = require("moment");
var async = require("async");

var ummon = require('..')({pause:true, autoSave:false});

test('Test creating dependent tasks', function(t){
  t.plan(3);

  async.series([
    function(callback){ ummon.createTask({"name":"hello","command": "echo hello" }, callback); },
    function(callback){ ummon.createTask({"name": "goodbye", "command": "echo goodbye && exit 1", "trigger": { "after": 'hello' }},  callback); },
    function(callback){ ummon.createTask({"name":"one","command": "echo one" }, callback); },
    function(callback){ ummon.createTask({"name":"two","command": "echo two", "trigger": {"after": "ummon.one"}}, callback); },
    function(callback){ ummon.createTask({"name":"twotwo","command": "echo twotwo", "trigger": {"after": "ummon.one"}}, callback); },
    function(callback){ ummon.createTask({"name":"three","command": "echo three", "trigger": {"after": "ummon.two"}}, callback); },
    function(callback){ ummon.createTask({"name":"four","command": "echo four", "trigger": {"after": "ummon.three"}}, callback); },
    function(callback){ ummon.createTask({"name":"five","command": "echo five", "trigger": {"after": "ummon.four"}}, callback); },
    function(callback){ ummon.createTask({"name":"six","command": "echo six", "trigger": {"after": "ummon.five"}}, callback); },
  ],
  function(err){
    t.equal(ummon.getTaskReferences('ummon.hello')[0], 'ummon.goodbye', 'ummon.hello is a dependent task for goodbye');
    t.equal(ummon.getTaskReferences('ummon.one')[1], 'ummon.twotwo', 'task one is referenced by two tasks');
    t.equal(ummon.getTaskDependencies('ummon.five')[0], 'ummon.four', 'task five is dependent on task four');
  });
});

test('Create a tasks with a wildcard trigger', function(t) {
  t.plan(2);
  ummon.tasks = [];
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
