'use strict';

var test = require("tap").test;

var queue = require('../lib/queue.js');

var ummon = { emit: function(name) {} }; // emulate event emitter

var testQueue = queue(ummon);


//                    Construct!
// - - - - - - - - - - - - - - - - - - - - - - - - -
test('construct an instance of a queue', function(t){
  t.plan(2);

  t.ok(testQueue, 'The queue is instatiated');
  t.equal(testQueue.items.length, 0, 'The queue is empty');
});


test('Test adding some items to the queue', function(t){
  t.plan(1);

  testQueue.push({id: 'one', command:'one'});
  testQueue.push({id: 'two', command:'two'});
  testQueue.push({id: 'three', command:'three'});
  testQueue.push({id: 'four', command:'four'});

  t.equal(testQueue.items.length, 4, 'There are four items in the queue');
});


test('Test retreiving the next item from the queue', function(t){
  t.plan(2);

  var item = testQueue.getNext();

  t.equal(testQueue.items.length, 3, 'There are now three items in the queue');
  t.equal(item.task.command, 'one', 'The correct item was returned');
});


test('Test retreiving the next item from the queue that is not currently running', function(t){
  t.plan(2);

  var item = testQueue.getNext(['two']);

  t.equal(testQueue.items.length, 2, 'There are now two items in the queue');
  t.equal(item.task.command, 'three', 'The correct item was returned');
});

test('Make sure an empty queue doesn\'t return nothing', function(t){
  t.plan(4);

  var item = testQueue.getNext(['two']);

  t.equal(testQueue.items.length, 1, 'Theres now one item in the queue');
  t.equal(item.task.command, 'four', 'The correct item was returned');

  var item2 = testQueue.getNext(['two']);

  t.equal(testQueue.items.length, 1, 'Theres still one item in the queue');
  t.equal(item2, false, 'No item was returned');
})