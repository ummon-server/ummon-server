'use strict';

var test = require("tap").test;
var moment = require("moment");
var async = require("async");

var ummon = require('..')();
ummon.pause = true;

test('Create a tasks with a wildcard trigger', function(t) {
  t.plan(3);

  // Create a bunch of dummy tasks
  async.series([
    function(callback){ ummon.createTask({"collection":"important","name":"one","command": "echo one" }, callback); },
    function(callback){ ummon.createTask({"collection":"important","name":"two","command": "echo two"}, callback); },
    function(callback){ ummon.createTask({"collection":"notimportant","name":"one","command": "echo two"}, callback); },
    // Now the wildcard tasks
    function(callback){ ummon.createTask({"collection":"cleanup","name":"important","command": "echo two", "trigger":"important.*" }, callback); },
    function(callback){ ummon.createTask({"collection":"cleanup","name":"all","command": "echo two", "trigger":"*" }, callback); },
  ],
  function(err){
    t.equal(ummon.getTaskReferences('important.one')[0], 'cleanup.important', 'cleanup.important references important.one as a dependant');
    t.equal(ummon.getTaskReferences('important.one')[1], 'cleanup.all', 'cleanup.all references important.one as a dependant');
    t.similar(ummon.getTaskDependencies('cleanup.all'), ['important.one','important.two','notimportant.one', 'cleanup.important'], 'cleanup.all depends on all the tasks');
  });
});

test('teardown', function(t){
  setImmediate(function() {
    process.exit();
  });
  t.end();
});
