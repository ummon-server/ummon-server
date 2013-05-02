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

var queue = require('../lib/queue.js');

var dispatcher = { emit: function(name) {} }; // emulate event emitter

var testQueue = queue(dispatcher);


//                    Construct!
// - - - - - - - - - - - - - - - - - - - - - - - - - 
test('construct an instance of a queue', function(t){
  t.plan(2);

  t.ok(testQueue, 'The queue is instatiated');
  t.equal(testQueue.items.length, 0, 'The queue is empty');
});


test('Test adding some items to the queue', function(t){
  t.plan(1);

  testQueue.push('one');
  testQueue.push('two');
  testQueue.push('three');
  testQueue.push('four');

  t.equal(testQueue.items.length, 4, 'There are four items in the queue');
});


test('Test retreiving the next iterm from the queue', function(t){
  t.plan(2);

  var item = testQueue.getNext();

  t.equal(testQueue.items.length, 3, 'There are now three items in the queue');
  t.equal(item, 'one', 'The correct item was returned');
});