'use strict';

var test = require("tap").test;
var moment = require("moment");

// var thingie, superEasy;

// test("make sure the thingie is a thing", function (t) {
//   t.equal(thingie, "thing", "thingie should be thing");
//   t.type(thingie, "string", "type of thingie is string");
//   t.ok(true, "this is always true");
//   t.notOk(false, "this is never true");
//   t.test("a child test", function (t) {
//     t.equal(this, superEasy, "right!?");
//     t.similar(7, 2, "ever notice 7 is kinda like 2?", {todo: true});
//     t.test("so skippable", {skip: true}, function (t) {
//       t.plan(1); // only one test in this block
//       t.ok(true, "but when the flag changes, it'll pass");
//       // no need to end, since we had a plan.
//     });
//     t.end();
//   });
//   t.ok(99, "can also skip individual assertions", {skip: true});
//   // end lets it know it's over.
//   t.end();
// });
// test("another one", function (t) {
//   t.plan(1);
//   t.ok(true, "It's ok to plan, and also end.  Watch.");
//   t.end(); // but it must match the plan!
// });

var ummon = require('..').create();


test('construct an instance of ummon', function(t){
  t.plan(1);

  t.ok(ummon, 'The server should exists');
});


test('Adding a task and ensure the correct order', function(t){
  t.plan(3);
  ummon.MAX_WORKERS = 0; // Don't run the task


  t.test('Create a task with a timed trigger and wait for it to add to the queue', function(t) {
    t.plan(4);
    ummon.createTask('default', 'hello', {
      "command": "echo Hello;",
      "trigger": {
        "time": moment().add('s', 1).toDate()
      }
    });

    t.ok(ummon.collections.default.tasks.hello, 'There is a hello task');

    ummon.dispatcher.once('queue.new', function(name){
      t.ok(true, 'The new emitter was emited');
      t.equal(name, 'hello', 'The task name was hello');
    });

    setTimeout(function(){
      t.equal(ummon.queue.length(), 1, 'There is one task in the queue after 1 second');
    }, '1100');

  });

  
  t.test('Create a dependant task', function(t) {
    t.plan(1);

    ummon.createTask('default', 'goodbye', {
      "command": "echo goodbye;",
      "trigger": {
        "after": 'hello'
      }
    });

    t.ok(ummon.collections.default.tasks.goodbye, 'There is a goodbye task');
  });


  t.test('Task hello is run, goodbye is queued and then run', function(t){
    t.plan(3);
    ummon.MAX_WORKERS = 5;
    
    ummon.runNextIfReady();

    ummon.dispatcher.once('queue.new', function(name){
      t.ok(true, 'The new emitter was emited');
      t.equal(name, 'goodbye', 'The task name was goodbye');
    });

    setTimeout(function(){
      t.equal(ummon.queue.length(), 0, 'The queue is now empty');
    }, '500');
  });
});