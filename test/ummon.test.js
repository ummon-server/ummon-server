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
  ummon.MAX_WORKERS = 0; // Don't run any task

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

test('Create a tasks with simplified trigger', function(t) {
  t.plan(6);

  ummon.createTask({
    "name":"everyminute",
    "command": "echo Hello;",
    "trigger": "* * * * *"
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
    t.equal(ummon.dependencies.subject('ummon.everyminute').references[0], 'ummon.aftereveryminute', 'aftereveryminute is dependent on everyminute');
  });

});


test('Create a dependent task', function(t) {
  t.plan(2);

  ummon.createTask({
    "name": "goodbye",
    "command": "echo goodbye;",
    "trigger": {
      "after": 'hello'
    }
  }, function(err, task){
    t.ok(ummon.tasks['ummon.goodbye'], 'There is a goodbye task');
    t.equal(ummon.dependencies.subject('ummon.hello').references[0], 'ummon.goodbye', 'ummon.hello is a dependent task for goodbye');
  });
});


test('Run the previously created tasks', function(t) {
  t.plan(8);

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

  ummon.MAX_WORKERS = 5;
  ummon.createWorkerIfReady();

  var pid = Object.keys(ummon.workers)[0];

  t.equal(ummon.workers[pid].run.id, testRun.id, 'The worker is in the list');
});


test('Test creating dependent tasks', function(t){
  t.plan(2);

  async.series([
    function(callback){ ummon.createTask({"name":"one","command": "echo one" }, callback); },
    function(callback){ ummon.createTask({"name":"two","command": "echo two", "trigger": {"after": "ummon.one"}}, callback); },
    function(callback){ ummon.createTask({"name":"twotwo","command": "echo twotwo", "trigger": {"after": "ummon.one"}}, callback); },
    function(callback){ ummon.createTask({"name":"three","command": "echo three", "trigger": {"after": "ummon.two"}}, callback); },
    function(callback){ ummon.createTask({"name":"four","command": "echo four", "trigger": {"after": "ummon.three"}}, callback); },
    function(callback){ ummon.createTask({"name":"five","command": "echo five", "trigger": {"after": "ummon.four"}}, callback); },
    function(callback){ ummon.createTask({"name":"six","command": "echo six", "trigger": {"after": "ummon.five"}}, callback); },
  ],
  function(err){
    t.equal(ummon.dependencies.subject('ummon.one').references[1], 'ummon.twotwo', 'task one is referenced by two tasks');
    t.equal(ummon.dependencies.subject('ummon.five').dependencies[0], 'ummon.four', 'task five is dependent on task four');
  });
});


test('Test updating a tasks', function(t){
  t.plan(4);

  ummon.updateTask(
    {"name":"twotwo","collection":"ummon","command": "echo twotwo", "trigger": {"time": moment().add('s', 1).toDate()} },
    function(err, task){
      t.equal(task.command, "echo twotwo", "The method should return a new Task");
      t.equal(ummon.dependencies.subject('ummon.one').references[0], 'ummon.two', 'The good reference remains');
      t.notOk(ummon.dependencies.subject('ummon.one').references[1], 'The old reference was removed');
      t.notOk(ummon.dependencies.subject('ummon.twotwo').dependencies[0], 'The task has no dependent tasks');  
  });
});


test('Delete a task and its dependencies', function(t){
  t.plan(2);

  ummon.deleteTask('ummon.five', function(err, task){
    t.notOk(ummon.dependencies.subject('ummon.four').references[0], 'Task four has no more references');
    t.notOk(ummon.dependencies.subject('ummon.five').dependencies[0], 'The task has no dependent tasks');    
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


test('Add an arbitrary command to the queue', function(t){
  t.plan(14);
  ummon.MAX_WORKERS = 0;
  
  ummon.on('queue.new', function(run){
    t.ok(true, 'The queue.new emitter was emited'); //Should fire twice
  });

  // Run an existing task with no dependencies
  ummon.runTask('science.nye', function(err, run){
    t.notOk(err, 'There is no error when an existing task is manual run');
    t.equal(run.task.id, 'science.nye', 'A right task was loaded');
    t.equal(run.triggeredBy, 'manual', 'A run is marked as manual');
  });
  
  // Run a task that will fail because of built in dependencies
  ummon.runTask('ummon.six', function(err, run){
    t.ok(err, 'There is an error when an enxisting task with a dependency is run');
    t.equal(err.message, 'The task ummon.six has a dependent task. Call that instead', 'The error says the right thing');
    t.notOk(run, 'There is no run when an enxisting task with a dependency is run');
  });

  // Force Run a task that has dependencies
  ummon.runTask('ummon.six', true, function(err, run){
    t.notOk(err, 'There is not an error when an enxisting task with a dependency is forced to run');
    t.equal(run.task.id, 'ummon.six', 'A right task was loaded');
    t.ok(run, 'There is a run when an enxisting task with a dependency is forced to run');
  });

  // Run a new, arbitrary command
  ummon.runTask({'command':'echo hello'}, true, function(err, run){
    t.notOk(err, 'There is no error when an arbitrary task is created');
    t.ok(run, 'There is a run when an arbitrary task is created');
  });
});


test('teardown', function(t){
  setImmediate(function() {
    process.exit();
  });
  t.end();
});