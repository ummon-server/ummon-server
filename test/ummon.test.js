'use strict';

var test = require("tap").test;
var moment = require("moment");
var async = require("async");

var ummon;

test('construct an instance of ummon', t => {
  t.plan(1);
  ummon = require('..')({pause: true, autoSave: false});
  t.ok(ummon, 'The server should exists');
});

var testRun;

test('Create a task with a timed trigger and wait for it to add to the queue', t => {
  t.plan(5);

  ummon.createTask({
    "name":"hello",
    "command": "echo Hello;",
    "env": {
      "TERM":"dummy"
    },
    "trigger": {
      "time": moment().add('ms', 100).toDate()
    }
  }, (err, task) => {
    t.ok(task, 'The callback returns a task');
    t.ok(ummon.tasks['ummon.hello'], 'There is a hello task');
    t.ok(ummon.timers['ummon.hello'], 'There is a hello task timer');
  });

  ummon.once('queue.new', run => {
    testRun = run;
    t.ok(true, 'The queue.new emitter was emited');
    t.equal(run.task.id, 'ummon.hello', 'The task name was hello');
  });

  setTimeout(() => {
    t.equal(ummon.queue.length(), 1, 'There is one task in the queue after 1 second');
  }, '101');

});


test('Test creating dependent tasks', t => {
  t.plan(4);

  async.series([
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
    t.ok(ummon.tasks['ummon.goodbye'], 'There is a goodbye task');
    t.equal(ummon.getTaskReferences('ummon.hello')[0], 'ummon.goodbye', 'ummon.hello is a dependent task for goodbye');
    t.equal(ummon.getTaskReferences('ummon.one')[1], 'ummon.twotwo', 'task one is referenced by two tasks');
    t.equal(ummon.getTaskDependencies('ummon.five')[0], 'ummon.four', 'task five is dependent on task four');
  });
});


test('Run the previously created tasks', t => {
  t.plan(8);

  ummon.removeAllListeners(['queue.new','worker.complete']); //Delete old listeners to keep things simple

  ummon.on('queue.new', run => {
    t.ok(true, 'The queue.new emitter was emited');
    t.equal(run.task.id, 'ummon.goodbye', 'The task ummon.goodbye was added to the queue after hello completed');
    t.equal(run.triggeredBy.id, testRun.id, 'The task ummon.goodbye was triggered by hello\'s last run');
  });

  ummon.on('worker.complete', run => {
    t.ok(run, 'The worker.complete event was emited'); // Emitted twice for both tasks

    setTimeout(() => {
      t.equal(Object.keys(ummon.workers).length, 0, 'The workers object is now empty');
    }, '100');
  });

  ummon.config.pause = false;
  ummon.createWorkerIfReady();

  var pid = Object.keys(ummon.workers)[0];
  t.equal(ummon.workers[pid].run.id, testRun.id, 'The worker is in the list');
});


test('Test updating a task with a task trigger', t => {
  t.plan(4);

  ummon.updateTask('ummon.twotwo', {"trigger": 'ummon.two'},
    (err, task) => {
      t.equal(task.command, "echo twotwo", "The method should return a new Task");
      t.equal(ummon.getTaskReferences('ummon.one')[0], 'ummon.two', 'The good reference remains');
      t.notOk(ummon.getTaskReferences('ummon.one')[1], 'The old reference was removed');
      t.equal(ummon.getTaskDependencies('ummon.twotwo')[0], 'ummon.two', 'There is a new dependency');
  });
});


test('Test updating a task with a time trigger', t => {
  t.plan(2);

  ummon.updateTask('ummon.twotwo', {"trigger": '* 10 * * *'},
    (err, task) => {
      t.equal(task.command, "echo twotwo", "The method should return a new Task");
      t.equal(ummon.timers['ummon.twotwo'].cronTime.source, '* 10 * * *', 'A new timer has been setup');
  });
});


test('Delete a task and its dependencies', t => {
  t.plan(2);

  ummon.deleteTask('ummon.five', (err, task) => {
    t.notOk(ummon.getTaskReferences('ummon.four')[0], 'Task four has no more references');
    t.notOk(ummon.getTaskDependencies('ummon.five')[0], 'The task has no dependent tasks');
  });
});


test('teardown', t => {
  setImmediate(() => {
    process.exit();
  });
  t.end();
});
