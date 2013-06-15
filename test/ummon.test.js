'use strict';

var test = require("tap").test;
var moment = require("moment");
var async = require("async");

var ummon;

test('construct an instance of ummon', function(t){
  t.plan(1);
  ummon = require('..').create();
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
    t.ok(ummon.tasks['default.hello'], 'There is a hello task');
    t.ok(ummon.timers['default.hello'], 'There is a hello task timer');
  });

  ummon.dispatcher.once('queue.new', function(run){
    testRun = run;
    t.ok(true, 'The queue.new emitter was emited');
    t.equal(run.task.id, 'default.hello', 'The task name was hello');
  });

  setTimeout(function(){
    t.equal(ummon.queue.length(), 1, 'There is one task in the queue after 1 second');
  }, '101');

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
    t.ok(ummon.tasks['default.goodbye'], 'There is a goodbye task');
    t.equal(ummon.dependencies.subject('default.hello').references[0], 'default.goodbye', 'default.hello is a dependent task for goodbye');
  });
});


test('Run the previously created tasks', function(t) {
  t.plan(8);

  ummon.dispatcher.on('queue.new', function(run){
    t.ok(true, 'The queue.new emitter was emited');
    t.equal(run.task.id, 'default.goodbye', 'The task default.goodbye was added to the queue after hello completed');
    t.equal(run.triggeredBy.id, testRun.id, 'The task default.goodbye was triggered by hello\'s last run');
  });

  ummon.dispatcher.on('worker.complete', function(run){
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
    function(callback){ ummon.createTask({"name":"two","command": "echo two", "trigger": {"after": "default.one"}}, callback); },
    function(callback){ ummon.createTask({"name":"twotwo","command": "echo twotwo", "trigger": {"after": "default.one"}}, callback); },
    function(callback){ ummon.createTask({"name":"three","command": "echo three", "trigger": {"after": "default.two"}}, callback); },
    function(callback){ ummon.createTask({"name":"four","command": "echo four", "trigger": {"after": "default.three"}}, callback); },
    function(callback){ ummon.createTask({"name":"five","command": "echo five", "trigger": {"after": "default.four"}}, callback); },
    function(callback){ ummon.createTask({"name":"six","command": "echo six", "trigger": {"after": "default.five"}}, callback); },
  ],
  function(err){
    t.equal(ummon.dependencies.subject('default.one').references[1], 'default.twotwo', 'task one is referenced by two tasks');
    t.equal(ummon.dependencies.subject('default.five').dependencies[0], 'default.four', 'task five is dependent on task four');
  });
});


test('Test updating a tasks', function(t){
  t.plan(4);

  ummon.updateTask(
    {"name":"twotwo","collection":"default","command": "echo twotwo", "trigger": {"time": moment().add('s', 1).toDate()} },
    function(err, task){
      t.equal(task.command, "echo twotwo", "The method should return a new Task");
      t.equal(ummon.dependencies.subject('default.one').references[0], 'default.two', 'The good reference remains');
      t.notOk(ummon.dependencies.subject('default.one').references[1], 'The old reference was removed');
      t.notOk(ummon.dependencies.subject('default.twotwo').dependencies[0], 'The task has no dependent tasks');  
  });
});


test('Delete a task and its dependencies', function(t){
  t.plan(2);

  ummon.deleteTask('default.five', function(err, task){
    t.notOk(ummon.dependencies.subject('default.four').references[0], 'Task four has no more references');
    t.notOk(ummon.dependencies.subject('default.five').dependencies[0], 'The task has no dependent tasks');    
  });
});


test('Create collections default values and retrieve a task that inherits them', function(t){
  t.plan(2);
  ummon.defaults.science = { 'cwd': '/user/bill' };

  async.series([
    function(callback){ ummon.createTask({"collection":"science", "name":"nye","command": "echo \"The science guy!\"" }, callback); },
    function(callback){ ummon.createTask({"collection":"science", "cwd":"/user/neil","name":"tyson","command": "echo \"The space guy!\"" }, callback); },
  ], function(err, results) {
    t.equal(results[0].cwd, '/user/bill', 'The nye task should have its cwd set by its collection defaults');
    t.equal(results[1].cwd, '/user/neil', 'The tyson task should override the collection defaults');
  });
  
});


test('Add an arbitrary command to the queue', function(t){
  t.plan(14);
  ummon.MAX_WORKERS = 0;
  
  ummon.dispatcher.on('queue.new', function(run){
    t.ok(true, 'The queue.new emitter was emited'); //Should fire twice
  });

  // Run an existing task with no dependencies
  ummon.runTask('science.nye', function(err, run){
    t.notOk(err, 'There is no error when an existing task is manual run');
    t.equal(run.task.id, 'science.nye', 'A right task was loaded');
    t.equal(run.triggeredBy, 'manual', 'A run is marked as manual');
  });
  
  // Run a task that will fail because of built in dependencies
  ummon.runTask('default.six', function(err, run){
    t.ok(err, 'There is an error when an enxisting task with a dependency is run');
    t.equal(err.message, 'The task default.six has a dependent task. Call that instead', 'The error says the right thing');
    t.notOk(run, 'There is no run when an enxisting task with a dependency is run');
  });

  // Force Run a task that has dependencies
  ummon.runTask('default.six', true, function(err, run){
    t.notOk(err, 'There is not an error when an enxisting task with a dependency is forced to run');
    t.equal(run.task.id, 'default.six', 'A right task was loaded');
    t.ok(run, 'There is a run when an enxisting task with a dependency is forced to run');
  });

  // Run a new, arbitrary command
  ummon.runTask({'command':'echo hello'}, true, function(err, run){
    t.notOk(err, 'There is no error when an arbitrary task is created');
    t.ok(run, 'There is a run when an arbitrary task is created');
  });
});


test('Autoload tasks from a json file', function(t){
  t.plan(8);

  ummon.config.tasksDir = "./fixtures/tasks/";

  ummon.autoLoadTasks(function(err){
    t.notOk(err, 'There should be no error');
    t.equal(ummon.defaults.autosample.cwd, '/var/www/website/', 'The collection defaults were properly loaded');
    ummon.getTask('autosample.task2', function(err, task){
      t.ok(task, 'The task flippn loaded');
      t.equal(task.cwd,'/var/www/website/', 'The collection defaults were properly loaded');
      t.equal(task.command,'./symfony w2h:process-data', 'The task command is set');
      
      t.ok(ummon.tasks['palace.pizza'], 'Second config file loaded and first collection loaded');
      t.ok(ummon.tasks['farm.pretzel'], 'Second config file loaded and second collection loaded');

      t.equal(ummon.dependencies.subject('autosample.task1').references[0],'autosample.task2', 'Task dependencies were setup properly');  
    });
  });

});


test('teardown', function(t){
  setImmediate(function() {
    process.exit();
  });
  t.end();
});