'use strict';

var test = require("tap").test;
var moment = require("moment");
var async = require("async");

var ummon = require('..')();
ummon.pause = true;
ummon.autoSave = false;

// Stub in some tasks
ummon.tasks = {
  'ummon.one': {"collection":"ummon"},
  'ummon.two': {"collection":"ummon"},
  'ummon.three': {"collection":"ummon"},
  'canada.four': {"collection":"canada"}
}

test('Return the proper task id', function(t){
  t.plan(3);
  t.equal(ummon.getTaskId('ummon.one'), 'ummon.one', "Return the proper task id");
  t.equal(ummon.getTaskId('one'), 'ummon.one', "Return the proper task id");
  t.equal(ummon.getTaskId('oneone'), false, "Yell if there isn't a task with that id");
})

test('Return an array of task ids', function(t) {
  t.plan(4);
  t.similar(ummon.getTaskIds(), ['ummon.one','ummon.two','ummon.three','canada.four'], 'getTaskIds() returns all of the tasks');
  t.similar(ummon.getTaskIds('*'), ['ummon.one','ummon.two','ummon.three','canada.four'], 'getTaskIds(*) returns all of the tasks');
  t.similar(ummon.getTaskIds('ummon.*'), ['ummon.one','ummon.two','ummon.three'], 'getTaskIds("ummon.*") returns all of the ummon tasks');
  t.similar(ummon.getTaskIds('ummon.one'), ['ummon.one'], 'getTaskIds("ummon.one") returns all of the ummon tasks');
});

test('Return an array of collection names', function(t){
  t.plan(1);
  t.similar(ummon.getCollections(), ['ummon','canada'], "There should be two collection names")
})

test('teardown', function(t){
  setImmediate(function() {
    process.exit();
  });
  t.end();
});
