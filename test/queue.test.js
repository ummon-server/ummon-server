'use strict';

var test = require("tap").test;

var queue = require('../lib/queue.js');

var ummon = { emit: function(name) {}, log: { error: function(err){}} }; // emulate event emitter

var testQueue = queue({maxSize: 4}, ummon);


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


test('Test adding an item to a full queue', function(t){
  t.plan(1);

  testQueue.push({id: 'five', command:'five'}, function(err){
    t.ok(err, 'There is an error');
  });
})


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


test('Make sure an empty queue doesn\'t return undefined', function(t){
  t.plan(4);

  var item = testQueue.getNext(['two']);

  t.equal(testQueue.items.length, 1, 'Theres now one item in the queue');
  t.equal(item.task.command, 'four', 'The correct item was returned');

  var item2 = testQueue.getNext(['two']);

  t.equal(testQueue.items.length, 1, 'Theres still one item in the queue');
  t.equal(item2, false, 'No item was returned');
})


test('Remove every task from the queue', function(t){
  t.plan(2);
  t.equal(testQueue.items.length, 1, 'The queue has one item');
  testQueue.clear();
  t.equal(testQueue.items.length, 0, 'The queue is empty');
})


test('Remove a certain task id from the queue', function(t){
  t.plan(2);

  testQueue.push({id: 'task.one', command:'one'});
  testQueue.push({id: 'task.one', command:'one'});
  testQueue.push({id: 'task.three', command:'three'});
  testQueue.push({id: 'task.four', command:'four'});

  testQueue.clear('task.one');
  t.equal(testQueue.items.length, 2, 'The are only two items in the queue');
  t.equal(testQueue.items[0].task.id, 'task.three' , 'The first item is no longer task.one');
})