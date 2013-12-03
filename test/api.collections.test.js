var test = require("tap").test;

var stream = require('stream');

var ummon = require('../lib/ummon')({pause:true, autoSave:false});
var api = require('../api')(ummon);


var collection = {
  "collection": "barankay",
  "defaults": {
    "cwd": "/Users/matt/tmp/"
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


test('Create new collection', function(t){
  t.plan(4);

  var req = { params: { collection: collection.collection}, body: JSON.stringify(collection) };
  var res = {};
  var next = function(){};

  res.json = function(status, json) {
    t.equal(status, 200, 'The status should be 200');
    t.equal(json.collections.length, 1, 'showTasks returns 1 collection');
    t.equal(json.collections[0].collection, "barankay", 'There is an ummon collection');
    t.ok(json.collections[0].tasks, 'There tasks in the ummon collection');
  };

  api.setTasks(req, res, next);
});


test('Set a collections default settings', function(t){
  t.plan(3);

  var req = { params: { "collection":"ummon" }, body: {"cwd":"/home/matt"} };
  var res = {};
  var next = function(){};

  res.json = function(status, json) {
    t.equal(status, 200, 'The status should be 200');
    t.equal(json.collection, 'ummon', 'The collection returned should be ummon');
    t.equal(json.defaults.cwd, '/home/matt', 'The task command should be echo');
  };

  api.setCollectionDefaults(req, res, next);
});


test('Show a collections default settings', function(t){
  t.plan(3);

  var req = { params: { "collection":"ummon" } };
  var res = {};
  var next = function(){};

  res.json = function(status, json) {
    t.equal(status, 200, 'The status should be 200');
    t.equal(json.collection, 'ummon', 'The collection returned should be ummon');
    t.equal(json.defaults.cwd, '/home/matt', 'The task command should be echo');
  };

  api.getCollectionDefaults(req, res, next);
});


test('Disable a collection', function(t){
  t.plan(2);

  var req = { params: { "collection":"barankay" } };
  var res = {};
  var next = function(){};

  res.json = function(status, json) {
    t.equal(status, 200, 'The status should be 200');
    t.similar(json.tasksDisabled, ['barankay.send-text-messages'], 'Specific tasks should of been disabled');
  };

  api.disableCollection(req, res, next);
});


test('Enable a collection', function(t){
  t.plan(2);

  var req = { params: { "collection":"barankay" } };
  var res = {};
  var next = function(){};

  res.json = function(status, json) {
    t.equal(status, 200, 'The status should be 200');
    t.similar(json.tasksEnabled, ['barankay.send-text-messages'], 'Specific tasks should of been enabled');
  };

  api.enableCollection(req, res, next);
});


test('teardown', function(t){
  setImmediate(function() {
    process.exit();
  });
  t.end();
});
