'use strict';

var test = require("tap").test;
var moment = require("moment");

var ummon;

test('construct an instance of ummon', function(t){
  t.plan(1);
  ummon = require('..').create();
  t.ok(ummon, 'The server should exists');
});


test('Adding a task and ensure the correct order', function(t){
  t.plan(3);
  ummon.MAX_WORKERS = 0; // Don't run any task


  t.test('Create a task with a timed trigger and wait for it to add to the queue', function(t) {
    t.plan(4);
    ummon.createTask({
      "name":"hello",
      "command": "echo Hello;",
      "trigger": {
        "time": moment().add('s', 1).toDate()
      }
    });

    t.ok(ummon.tasks['default.hello'], 'There is a hello task');

    ummon.dispatcher.once('queue.new', function(run){
      t.ok(true, 'The new emitter was emited');
      t.equal(run.task.id, 'default.hello', 'The task name was hello');
    });

    setTimeout(function(){
      t.equal(ummon.queue.length(), 1, 'There is one task in the queue after 1 second');
    }, '1100');

  });

  
  t.test('Create a dependant task', function(t) {
    t.plan(1);

    ummon.createTask({
      "name": "goodbye",
      "command": "echo goodbye;",
      "trigger": {
        "after": 'hello'
      }
    });

    t.ok(ummon.tasks['default.goodbye'], 'There is a goodbye task');
  });


  t.test('Task hello is run, goodbye is queued and then run', function(t){
    t.plan(3);
    ummon.MAX_WORKERS = 5;

    ummon.dispatcher.once('queue.new', function(run){
      t.ok(true, 'The new emitter was emited');
      t.equal(run.task.name, 'goodbye', 'The task name was goodbye');
    });

    ummon.createWorkerIfReady();

    setTimeout(function(){
      t.equal(ummon.queue.length(), 0, 'The queue is now empty');
    }, '500');
  });
});


test('Test creating dependant tasks', function(t){
  t.plan(2);

  ummon.createTask({"name":"one","command": "echo one", "trigger": {"time": moment().add('s', 1).toDate()} });
  ummon.createTask({"name":"two","command": "echo two", "trigger": {"after": "default.one"} });
  ummon.createTask({"name":"twotwo","command": "echo twotwo", "trigger": {"after": "default.one"} });
  ummon.createTask({"name":"three","command": "echo three", "trigger": {"after": "default.two"} });
  ummon.createTask({"name":"four","command": "echo four", "trigger": {"after": "default.three"} });
  ummon.createTask({"name":"five","command": "echo five", "trigger": {"after": "default.four"} });
  ummon.createTask({"name":"six","command": "echo six", "trigger": {"after": "default.five"} });

  t.equal(ummon.dependencies.subject('default.one').references[1], 'default.twotwo', 'task one is referenced by two tasks');
  t.equal(ummon.dependencies.subject('default.five').dependencies[0], 'default.four', 'task five is dependant on task four');
});


test('Test updating a tasks', function(t){
  t.plan(4);

  var task = ummon.updateTask({"name":"twotwo","collection":"default","command": "echo twotwo", "trigger": {"time": moment().add('s', 1).toDate()} });

  t.equal(task.command, "echo twotwo", "The method should return a new Task");
  t.equal(ummon.dependencies.subject('default.one').references[0], 'default.two', 'The good reference remains');
  t.notOk(ummon.dependencies.subject('default.one').references[1], 'The old reference was removed');
  t.notOk(ummon.dependencies.subject('default.twotwo').dependencies[0], 'The task has no dependant tasks');
});


test('Delete a task and its dependencies', function(t){
  t.plan(2);

  ummon.deleteTask('default.five');
  t.notOk(ummon.dependencies.subject('default.four').references[0], 'Task four has no more references');
  t.notOk(ummon.dependencies.subject('default.five').dependencies[0], 'The task has no dependant tasks');
});


test('Create collections default values and retrieve a task that inherits them', function(t){
  t.plan(2);

  //ummon.setDefaults():
  ummon.defaults.science = { 'cwd': '/user/bill' };
  ummon.createTask({"collection":"science", "name":"nye","command": "echo \"The science guy!\"" });
  ummon.createTask({"collection":"science", "cwd":"/user/neil","name":"tyson","command": "echo \"The space guy!\"" });
  var task = ummon.getTask('science.nye');
  var task2 = ummon.getTask('science.tyson');
  t.equal(task.cwd, '/user/bill', 'The nye task should have its cwd set by its collection defaults');
  t.equal(task2.cwd, '/user/neil', 'The tyson task should override the collection defaults');
});


test('Autoload tasks from a json file', function(t){
  t.plan(5);

  var autoloadUmmon = require('..').create({"tasks":"./fixtures/tasks.json"});

  t.equal(autoloadUmmon.defaults.sample.cwd, '/var/www/website/', 'The collection defaults were properly loaded');
  
  var task = autoloadUmmon.getTask('sample.task2');
  t.ok(task, 'The task flippn loaded');
  t.equal(task.cwd,'/var/www/website/', 'The collection defaults were properly loaded');
  t.equal(task.command,'./symfony w2h:process-data', 'The task command is set');
  
  t.equal(autoloadUmmon.dependencies.subject('sample.task1').references[0],'sample.task2', 'Task dependancies were setup properly');
});


test('teardown', function(t){
  setImmediate(function() {
    process.exit();
  });
  t.end();
});