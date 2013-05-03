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

var collection = require('../lib/collection.js');

var testCollection = collection('default');

//                    Construct!
// - - - - - - - - - - - - - - - - - - - - - - - - - 
test('construct an instance of ummon', function(t){
  t.plan(1);

  t.ok(testCollection, 'The server should exists');
});



//                Add a task to the list!
// - - - - - - - - - - - - - - - - - - - - - - - - - 
// 
var sampleTask = {
  "name": "sleep",
  "cwd": "/var/www/website2/",
  "command": "sleep 1 && echo 'Task Finished'",
  "trigger": {
    "time": "*/10 * * * *"
  }
};
 

test('Test successfully adding a task to task list', function(t){
  t.plan(3);

  testCollection.add(sampleTask);

  t.ok(testCollection.tasks.sleep, 'There should be a sleep task');
  t.equal(testCollection.tasks.sleep.cwd, '/var/www/website2/', 'The tasks cwd should be correct: /var/www/website2/');
  
  t.test('Test failing to add a duplicate task to task list', function(t){
    t.plan(2);
    try {
      testCollection.add(sampleTask);
    } 
    catch(e) {
      t.ok(e, 'There should be an error object');
      t.equal(e.message, 'A task with that name already exists in collection:default','The error message should be correct');
    }
  });
});


test('Test creating dependant tasks', function(t){
  t.plan(2);

  t.test('Test creating a single dependant task', function(t){
    t.plan(1);
    testCollection.add({
      "name": "sleepmore",
      "command": "sleep 5 && echo 'Task Finished'",
      "trigger": {
        "after": "sleep"
      }
    });

    t.equal(testCollection.dependencies.subject('sleepmore').dependencies[0], 'sleep', 'sleepmore is a dependant task of sleep');
  });

  t.test('Test creating many dependant tasks', function(t){
    t.plan(2);

    testCollection.add({"name":"one","command": "echo one", "trigger": {"time": ""} });
    testCollection.add({"name":"two","command": "echo two", "trigger": {"after": "one"} });
    testCollection.add({"name":"twotwo","command": "echo twotwo", "trigger": {"after": "one"} });
    testCollection.add({"name":"three","command": "echo three", "trigger": {"after": "two"} });
    testCollection.add({"name":"four","command": "echo four", "trigger": {"after": "three"} });
    testCollection.add({"name":"five","command": "echo five", "trigger": {"after": "four"} });
    testCollection.add({"name":"six","command": "echo six", "trigger": {"after": "five"} });

    t.similar(testCollection.dependencies.subject('one').references, ['two', 'twotwo'], 'task one is referenced by two tasks');
    t.similar(testCollection.dependencies.subject('five').dependencies, ['four'], 'task five is dependant on task four');
  });
});