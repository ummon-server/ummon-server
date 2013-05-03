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

var ummon = require('../lib/ummon').create();

var api = require('../lib/api')(ummon);


//                    Construct!
// - - - - - - - - - - - - - - - - - - - - - - - - - 
test('Test successfully create the api object', function(t){
  t.ok(api, 'The api object should exist');
  t.ok(api.ps, 'The ps function should exist');
  t.ok(api.status, 'The status function should exist');
  t.ok(api.log, 'The log function should exist');
  t.ok(api.createTask, 'The createTask function should exist');

  t.end();
});

test('Show processes', function(t){
  t.plan(2);

  var req = {};
  var res = {};
  res.json = function(status, json) {
    t.type(json.count, 'number', 'The count should be a number');
    t.type(json.workers, 'object', 'The workers should be an array'); // This should be an array. Why is it an object?
  };

  api.ps(req, res);
});


test('Create a task', function(t){
  t.plan(2);
  
  var req = { body: {"name":"test", "command":"echo hello", "trigger": {"time":"* * * * *"}}};
  var res = {};
  res.json = function(status, json) {
    t.equal(status, 200, 'The status should be 200');
    t.equal(json.message, 'Task test successfully created in the default collection', 'The message should be correct');
  };
  
  api.createTask(req, res);
});

test('teardown', function(t){
  setImmediate(function() {
    process.exit();
  });
  t.end();
});