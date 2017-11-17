'use strict';

var test = require("tap").test;

var ummon = require('..')({pause:true, autoSave:false});

// Stub in some tasks
var collection = {
  "collection": "barankay",
  "defaults": {
    "cwd": "/Users/matt/tmp/"
  },
  "config": {
    "enabled": true
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
  t.plan(7);
  ummon.createCollectionAndTasks(collection, function(err){
    t.equal(ummon.defaults.barankay.cwd, '/Users/matt/tmp/', 'Defaults were set')
    t.equal(ummon.tasks['barankay.send-text-messages'].command, 'sh test.sh', 'Tasks were set')
    t.ok(ummon.timers['barankay.send-text-messages'], 'Timers were setup')
    t.equal(ummon.config.collections.barankay.enabled, true, 'Settings were set')
    ummon.getTasks(collection.collection, function(err, tasks){
      t.equal(tasks[0].collection, 'barankay');
      t.equal(tasks[0].defaults.cwd, '/Users/matt/tmp/');
      t.equal(tasks[0].config.enabled, true);
    })
  });
})



var disabledCollection = {
  "collection": "disabledCollection",
  "defaults": {
    "cwd": "/Users/matt/tmp/"
  },
  "config": {
    "enabled": false
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

test('Create a collection that is disabled', function(t){
  t.plan(7);
  ummon.createCollectionAndTasks(disabledCollection, function(err){
    t.equal(ummon.defaults.disabledCollection.cwd, '/Users/matt/tmp/', 'Defaults were set')
    t.equal(ummon.tasks['disabledCollection.send-text-messages'].command, 'sh test.sh', 'Tasks were set')
    t.notOk(ummon.timers['disabledCollection.send-text-messages'], 'Timers were not setup')
    t.equal(ummon.config.collections.disabledCollection.enabled, false, 'Settings were set')
    ummon.getTasks(disabledCollection.collection, function(err, tasks){
      t.equal(tasks[0].collection, 'disabledCollection');
      t.equal(tasks[0].defaults.cwd, '/Users/matt/tmp/');
      t.equal(tasks[0].config.enabled, false);
    })
  });
})

test('teardown', function(t){
  setImmediate(function() {
    process.exit();
  });
  t.end();
});
