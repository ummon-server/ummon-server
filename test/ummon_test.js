'use strict';

var test = require("tap").test;

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

var ummon = require('..').createServer();


test('construct an instance of ummon', function(t){
  t.plan(1);

  t.ok(ummon, 'The server should exists');
});


test('Add a task to the default collection', function(t){
  t.plan(1);

  ummon.createTask('default', 'sleep', {
    "cwd": "~/src/ummon",
    "command": "for count in one two three four five; do echo $count && sleep 1; done;",
    // "arguments": ["--verbose", "--env=staging"],
    "trigger": {
      "time": "*/10 * * * *"
    }
  });

  t.ok(ummon.collections.default.tasks.sleep, 'The server should exists');
});


test('Add a task from the default collection to the queue', function(t){
  t.plan(2);
  ummon.MAX_WORKERS = 0;
  ummon.queue.on('new', function(){
    t.ok(true, 'The event emitter was emited called');
  });

  ummon.queue.push(ummon.collections.default.tasks.sleep);

  t.equal(ummon.queue.items.length,1, 'There is one task in the queue');
});



test('Add a task from the default collection to the queue and run it', function(t){
  t.plan(1);
  ummon.MAX_WORKERS = 5;
  
  ummon.queue.push(ummon.collections.default.tasks.sleep);

  t.equal(ummon.queue.items.length,1, 'There is one task in the queue');
});