'use strict';

var test = require("tap").test;

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

var task = require('../lib/task.js');

//                    Construct!
// - - - - - - - - - - - - - - - - - - - - - - - - - 
test('Test successfully creating a task', function(t){
  t.plan(2);

  var testTask = task({
    "name":"sleep5",
    "collection":"default",
    "cwd": "/var/www/website2/",
    "command": "sleep 5 && echo 'Task Finished'",
    "trigger": {
      "time": "*/10 * * * *"
    }
  });

  t.ok(testTask, 'The test object should exist');
  t.equal(testTask.id, 'default.sleep5', 'The test object should exist');
});


test('Test creating a task that errors', function(t){
  t.plan(2);

  var testTask = false;
  try {
    testTask = task({
      "name":"sleep5",
      "collection":"default",
      "command": "sleep 5 && echo 'Task Finished'"
    });
  } 
  catch(e) {
    t.ok(e, 'There should be an error');
    t.equal(e.message, 'A task must have at least one trigger','There error message should be correct');
  }
});