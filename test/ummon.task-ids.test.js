'use strict';

var test = require("tap").test;
var moment = require("moment");
var async = require("async");

var ummon = require('..')({pause:true, autoSave:false});

// Stub in some tasks
ummon.tasks = {
  'ummon.one': {"collection":"ummon"},
  'ummon.two': {"collection":"ummon"},
  'ummon.three': {"collection":"ummon"},
  'canada.four': {"collection":"canada"}
}

test('Return the proper task id', t => {
  t.plan(2);
  t.equal(ummon.getTaskId('ummon.one'), 'ummon.one', "Return the proper task id");
  t.equal(ummon.getTaskId('one'), 'ummon.one', "Return the proper task id");
})

test('Return an array of task ids', t => {
  t.plan(5);
  t.similar(ummon.getTaskIds(), ['ummon.one','ummon.two','ummon.three','canada.four'], 'getTaskIds() returns all of the tasks');
  t.similar(ummon.getTaskIds('*'), ['ummon.one','ummon.two','ummon.three','canada.four'], 'getTaskIds(*) returns all of the tasks');
  t.similar(ummon.getTaskIds('ummon'), ['ummon.one','ummon.two','ummon.three'], 'getTaskIds("ummon") returns all of the ummon tasks');
  t.similar(ummon.getTaskIds('ummon.*'), ['ummon.one','ummon.two','ummon.three'], 'getTaskIds("ummon.*") returns all of the ummon tasks');
  t.similar(ummon.getTaskIds('ummon.one'), ['ummon.one'], 'getTaskIds("ummon.one") returns all of the ummon tasks');
});

test('Return an array of collection names', t => {
  t.plan(1);
  t.similar(ummon.getCollections(), ['ummon','canada'], "There should be two collection names")
})

test('teardown', t => {
  setImmediate(() => {
    process.exit();
  });
  t.end();
});
