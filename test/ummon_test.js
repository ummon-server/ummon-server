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

var ummon = require('..');

var server = ummon.createServer();


//                    Construct!
// - - - - - - - - - - - - - - - - - - - - - - - - - 
test('construct an instance of ummon', function(t){
  t.plan(1);

  t.ok(server, 'The server should exists');
});


var sampleTest = {
  "cwd": "/var/www/website2/",
  "command": "sleep 5 && echo 'Task Finished'",
  "arguments": ["--verbose", "--env=staging"],
  "trigger": {
    "time": "*/10 * * * *"
  }
};


//                Add a task to the list!
// - - - - - - - - - - - - - - - - - - - - - - - - - 
test('Test successfully adding a task to task list', function(t){
  t.plan(3);

  server.addTask('task1', sampleTest, function(err){
    t.notOk(err, 'No error');
    t.type(server.tasks.task1, 'object', 'Task should be first object in queue');
    t.equal(server.tasks.task1.command, "sleep 5 && echo 'Task Finished'", 'Task command should be correct');
    t.end();
  });

});

test('Test failing adding a task to task list', function(t){
  t.plan(1);
  server.addTask('task1', sampleTest, function(err){
    t.ok(err, 'There is an error');
    t.end();
  });
});


//                    QUEUEING!
// - - - - - - - - - - - - - - - - - - - - - - - - - 
test('Enqueue a task from the task list', function(t) {
  t.plan(2);

  server.enqueueTask('task1', function(err){
    t.notOk(err, 'No error');
    t.equal(server.queue.length, 1, 'There should be a task in the queue');
    t.end();
  });
});



