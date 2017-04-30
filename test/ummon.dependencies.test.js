'use strict';

var test = require("tap").test;
var moment = require("moment");
var async = require("async");

var ummon = require('..')({pause:true, autoSave:false});

test('Test creating dependent tasks', t => {
  t.plan(3);

  async.series([
    callback => { ummon.createTask({"name":"hello","command": "echo hello" }, callback); },
    callback => { ummon.createTask({"name": "goodbye", "command": "echo goodbye && exit 1", "trigger": { "after": 'hello' }},  callback); },
    callback => { ummon.createTask({"name":"one","command": "echo one" }, callback); },
    callback => { ummon.createTask({"name":"two","command": "echo two", "trigger": {"after": "ummon.one"}}, callback); },
    callback => { ummon.createTask({"name":"twotwo","command": "echo twotwo", "trigger": {"after": "ummon.one"}}, callback); },
    callback => { ummon.createTask({"name":"three","command": "echo three", "trigger": {"after": "ummon.two"}}, callback); },
    callback => { ummon.createTask({"name":"four","command": "echo four", "trigger": {"after": "ummon.three"}}, callback); },
    callback => { ummon.createTask({"name":"five","command": "echo five", "trigger": {"after": "ummon.four"}}, callback); },
    callback => { ummon.createTask({"name":"six","command": "echo six", "trigger": {"after": "ummon.five"}}, callback); },
  ],
  err => {
    t.equal(ummon.getTaskReferences('ummon.hello')[0], 'ummon.goodbye', 'ummon.hello is a dependent task for goodbye');
    t.equal(ummon.getTaskReferences('ummon.one')[1], 'ummon.twotwo', 'task one is referenced by two tasks');
    t.equal(ummon.getTaskDependencies('ummon.five')[0], 'ummon.four', 'task five is dependent on task four');
  });
});

test('Create tasks with wildcard triggers', t => {
  t.plan(3);
  ummon.tasks = [];
  // Create a bunch of dummy tasks
  async.series([
    callback => { ummon.createTask({"collection":"important","name":"one","command": "echo one" }, callback); },
    callback => { ummon.createTask({"collection":"important","name":"two","command": "echo two"}, callback); },
    callback => { ummon.createTask({"collection":"notimportant","name":"one","command": "echo two"}, callback); },
    callback => { ummon.createTask({"collection":"cleanup","name":"important","command": "echo two", "trigger":"important.*" }, callback); },
    callback => { ummon.createTask({"collection":"cleanup","name":"all","command": "echo two", "trigger":"*" }, callback); },
  ],
  err => {
    t.deepEqual(ummon.getTaskReferences('important.one'), ['cleanup.important','cleanup.all'], 'important.one references both cleanup tasks');
    t.deepEqual(ummon.getTaskDependencies('cleanup.all'), ['important.one','important.two','notimportant.one', 'cleanup.important'], 'cleanup.all depends on all tasks except itself');
    t.deepEqual(ummon.getTaskReferences('cleanup.all'), [], 'no references for cleanup.all task');
  });
});

test('teardown', t => {
  setImmediate(() => {
    process.exit();
  });
  t.end();
});
