'use strict';

var test = require("tap").test;
var moment = require("moment");
var async = require("async");

var ummon;

test('construct an instance of ummon', function(t){
  t.plan(1);
  ummon = require('..')();
  t.ok(ummon, 'The server should exists');
});

var testRun;

test('Create a task with a timed trigger and wait for it to add to the queue', function(t) {
  t.plan(6);
  ummon.pause = true; // Don't run any task

  ummon.createTask({
    "name":"hello",
    "command": "echo Hello;",
    "trigger": {
      "time": moment().add('ms', 100).toDate()
    }
  }, function(err, task){
    t.ok(task, 'The callback returns a task');
    t.ok(ummon.tasks['ummon.hello'], 'There is a hello task');
    t.ok(ummon.timers['ummon.hello'], 'There is a hello task timer');
  });

  ummon.once('queue.new', function(run){
    testRun = run;
    t.ok(true, 'The queue.new emitter was emited');
    t.equal(run.task.id, 'ummon.hello', 'The task name was hello');
  });

  setTimeout(function(){
    t.equal(ummon.queue.length(), 1, 'There is one task in the queue after 1 second');
  }, '101');

});


test('Test creating dependent tasks', function(t){
  t.plan(4);

  async.series([
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
    t.ok(ummon.tasks['ummon.goodbye'], 'There is a goodbye task');
    t.equal(ummon.getTaskReferences('hello')[0], 'ummon.goodbye', 'ummon.hello is a dependent task for goodbye');
    t.equal(ummon.getTaskReferences('ummon.one')[1], 'ummon.twotwo', 'task one is referenced by two tasks');
    t.equal(ummon.getTaskDependencies('ummon.five')[0], 'ummon.four', 'task five is dependent on task four');
  });
});


test('Run the previously created tasks', function(t) {
  t.plan(8);

  ummon.removeAllListeners(['queue.new','worker.complete']); //Delete old listeners to keep things simple

  ummon.on('queue.new', function(run){
    t.ok(true, 'The queue.new emitter was emited');
    t.equal(run.task.id, 'ummon.goodbye', 'The task ummon.goodbye was added to the queue after hello completed');
    t.equal(run.triggeredBy.id, testRun.id, 'The task ummon.goodbye was triggered by hello\'s last run');
  });

  ummon.on('worker.complete', function(run){
    t.ok(run, 'The worker.complete event was emited'); // Emitted twice for both tasks

    setTimeout(function(){
      t.equal(Object.keys(ummon.workers).length, 0, 'The workers object is now empty');
    }, '100');
  });

  ummon.pause = false;
  ummon.createWorkerIfReady();

  var pid = Object.keys(ummon.workers)[0];

  t.equal(ummon.workers[pid].run.id, testRun.id, 'The worker is in the list');
});


test('Create a tasks with simplified trigger', function(t) {
  t.plan(6);

  ummon.createTask({
    "name":"everyminute",
    "command": "echo Hello;",
    "trigger": "* 5 * * *"
  }, function(err, task){
    t.ok(task, 'The callback returns a task');
    t.ok(ummon.tasks['ummon.everyminute'], 'There is a everyminute task');
    t.ok(ummon.timers['ummon.everyminute'], 'There is a everyminute task timer');
  });

  ummon.createTask({
    "name":"aftereveryminute",
    "command": "echo Hello;",
    "trigger": "everyminute"
  }, function(err, task){
    t.ok(task, 'The callback returns a task');
    t.ok(ummon.tasks['ummon.aftereveryminute'], 'There is a aftereveryminute task');
    t.equal(ummon.getTaskReferences('ummon.everyminute')[0], 'ummon.aftereveryminute', 'aftereveryminute is dependent on everyminute');
  });

});


test('Test updating a tasks', function(t){
  t.plan(4);

  ummon.updateTask(
    {"name":"twotwo","collection":"ummon","command": "echo twotwo", "trigger": {"time": moment().add('s', 1).toDate()} },
    function(err, task){
      t.equal(task.command, "echo twotwo", "The method should return a new Task");
      t.equal(ummon.getTaskReferences('ummon.one')[0], 'ummon.two', 'The good reference remains');
      t.notOk(ummon.getTaskReferences('ummon.one')[1], 'The old reference was removed');
      t.notOk(ummon.getTaskDependencies('ummon.twotwo')[0], 'The task has no dependent tasks');
  });
});


test('Delete a task and its dependencies', function(t){
  t.plan(2);

  ummon.deleteTask('ummon.five', function(err, task){
    t.notOk(ummon.getTaskReferences('ummon.four')[0], 'Task four has no more references');
    t.notOk(ummon.getTaskDependencies('ummon.five')[0], 'The task has no dependent tasks');
  });
});


test('Create collections default values and retrieve a task that inherits them', function(t){
  t.plan(2);
  ummon.defaults.science = { 'cwd': '/user/bill' };

  async.series([
    function(callback){ ummon.createTask({"collection":"science", "name":"nye","command": "echo \"The science guy!\"" }, callback); },
    function(callback){ ummon.createTask({"collection":"science", "cwd":"/user/neil","name":"tyson","command": "echo \"The space guy!\"" }, callback); },
  ], function(err, results) {
    t.notOk(results[0].cwd, 'The nye task shouldn\'t have its cwd set. It\'s in the collection defaults');
    t.equal(results[1].cwd, '/user/neil', 'The tyson task should override the collection defaults');
  });

});


test('teardown', function(t){
  setImmediate(function() {
    process.exit();
  });
  t.end();
});
