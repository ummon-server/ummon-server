'use strict';

var test = require("tap").test;
var moment = require("moment");
var async = require("async");

var ummon = require('..')({pause:true, autoSave:false});

// Stub in some tasks
var collection = {
  "collection": "barankay",
  "defaults": {
    "cwd": "/Users/matt/tmp/"
  },
  "config": {
    "pause": false
  },
  "tasks": {
    "send-text-messages": {
      "command": "sh test.sh",
      "cwd": "/Users/matt/tmp",
      "trigger": {
        "time": "* * * * *"
      }
    }
  }
}

test('Create a collection from an object', function(t){
  t.plan(6);
  ummon.createCollectionAndTasks(collection, function(err){
    t.equal(ummon.defaults.barankay.cwd, '/Users/matt/tmp/', 'Defaults were set')
    t.equal(ummon.tasks['barankay.send-text-messages'].command, 'sh test.sh', 'Tasks were set')
    t.equal(ummon.config.collections.barankay.pause, false, 'Settings were set')
    ummon.getTasks(collection.collection, function(err, tasks){
      t.equal(tasks[0].collection, 'barankay');
      t.equal(tasks[0].defaults.cwd, '/Users/matt/tmp/');
      t.equal(tasks[0].config.pause, false);
    })
  });
})

test('teardown', function(t){
  setImmediate(function() {
    process.exit();
  });
  t.end();
});
