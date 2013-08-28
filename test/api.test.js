var test = require("tap").test;

var stream = require('stream');

var ummon = require('../lib/ummon')({pause:true, autoSave:false});
var api = require('../api')(ummon);

//                    Construct!
// - - - - - - - - - - - - - - - - - - - - - - - - -
test('Test successfully create the api object', function(t){
  t.ok(api, 'The api object should exist');
  t.ok(api.ps, 'The ps function should exist');
  t.ok(api.createTask, 'The createTask function should exist');

  t.end();
});

test('Show processes', function(t){
  t.plan(2);

  var req = {};
  var res = {};
  var next = function(){};

  res.json = function(status, json) {
    t.type(json.count, 'number', 'The count should be a number');
    t.type(json.runs, 'object', 'The workers should be an object');
  };

  api.ps(req, res, next);
});

test('get server status', function(t){
  t.plan(7);

  var req = {};
  var res = {};
  var next = function(){};

  res.json = function(status, json) {
    t.type(json.workers.length, 'number', 'workers should be an object');
    t.type(json.queue.length, 'number', 'queue should be an array');
    t.type(json.activeTimers, 'object', 'activeTimers should be an object');
    t.type(json.isPaused, 'boolean', 'isPaused should be a boolean');
    t.type(json.maxWorkers, 'number', 'maxWorkers should be a number');
    t.type(json.collections.length, 'number', 'collections should be an array');
    t.type(json.totalTasks, 'number', 'totalTasks should be a number');
  };

  api.getStatus(req, res, next);
});

test('get server config', function(t){
  t.plan(3);

  var req = {};
  var res = {};
  var next = function(){};

  res.json = function(status, json) {
    t.type(json.name, 'string', 'name should be an object');
    t.type(json.createWorkerPollInterval, 'number', 'createWorkerPollInterval should be a number');
    t.type(json.log.path, 'string', 'log.path should be a string');
  };

  api.getConfig(req, res, next);
});


test('set server config', function(t){
  t.plan(3);

  var req = {query: {name:"science", workerToCpuRatio: "1.50", pause:"true"}};
  var res = {};
  var next = function(){};

  res.json = function(status, json) {
    t.equal(json.name, 'science', 'name should be science');
    t.equal(json.workerToCpuRatio, 1.50, 'createWorkerPollInterval should be a number');
    t.equal(json.pause, true, 'pause should be false');
  };

  api.setConfig(req, res, next);
});


test('Create a task', function(t){
  t.plan(2);

  var req = { body: {"name":"test", "command":"echo hello", "trigger": {"time":"* * * * *"}}};
  var res = {};
  var next = function(){};

  res.json = function(status, json) {
    t.equal(status, 200, 'The status should be 200');
    t.equal(json.message, 'Task ummon.test successfully created', 'The message should be correct');
  };

  api.createTask(req, res, next);
});


test('Show a single task', function(t){
  t.plan(3);

  var req = { params: { "taskid":"ummon.test" } };
  var res = {};
  var next = function(){};

  res.json = function(status, json) {
    t.equal(status, 200, 'The status should be 200');
    t.equal(json.task.name, 'test', 'The task name should be test');
    t.equal(json.task.command, 'echo hello', 'The task command should be echo');
  };

  api.getTask(req, res, next);
});


test('Show multiple tasks', function(t){
  t.plan(4);

  var req = { params: {} };
  var res = {};
  var next = function(){};

  res.json = function(status, json) {
    t.equal(status, 200, 'The status should be 200');
    t.equal(json.collections.length, 1, 'showTasks returns 1 collection');
    t.ok(json.collections[0], 'There is an ummon collection');
    t.ok(json.collections[0].tasks, 'There tasks in the ummon collection');
  };

  api.getTasks(req, res, next);

});


test('Update a task', function(t){
  t.plan(3);

  var req = { params: { "taskid":"ummon.test"}, body: {"name":"test", "collection":"ummon", "command":"echo goodbye", "trigger": {"time":"* * * * *"}} };
  var res = {};
  var next = function(){};

  res.json = function(status, json) {
    t.equal(status, 200, 'The status should be 200');
    t.equal(json.task.name, 'test', 'The task name should be test');
    t.equal(json.task.command, 'echo goodbye', 'The task command should be echo');
  };

  api.updateTask(req, res, next);
});


test('Disable a task', function(t){
  t.plan(4);

  var req = { params: { "taskid":"ummon.test"} };
  var res = {};
  var next = function(){};

  res.json = function(status, json) {
    t.equal(status, 200, 'The status should be 200');
    t.equal(json.message, "Task ummon.test disabled", 'The message should be correct');
    t.equal(ummon.tasks["ummon.test"].enabled, false, 'The task should be marked as disabled');
    t.notOk(ummon.timers["ummon.test"], 'The timer should be deleted');
  };

  api.disableTask(req, res, next);
});


test('Enable a task', function(t){
  t.plan(4);

  var req = { params: { "taskid":"ummon.test"} };
  var res = {};
  var next = function(){};

  res.json = function(status, json) {
    t.equal(status, 200, 'The status should be 200');
    t.equal(json.message, "Task ummon.test enabled", 'The message should be correct');
    t.equal(ummon.tasks["ummon.test"].enabled, true, 'The task should be marked as enabled');
    t.not(ummon.timers["ummon.test"], 'The timer should be created');
  };

  api.enableTask(req, res, next);
});


test('Delete a task', function(t){
  t.plan(3);

  var req = { params: { "taskid":"ummon.test"} };
  var res = {};
  var next = function(){};

  res.json = function(status) {
    t.equal(status, 200, 'The status should be 200');
    t.notOk(ummon.timers["ummon.test"], 'The timer should be deleted');
    t.notOk(ummon.tasks["ummon.test"], 'The task should be deleted');
  };

  api.deleteTask(req, res, next);
});


test('Return a log', function(t){
  t.plan(1);
  var x = 0;
  var req = { params: { collection: 'default' }, query: { lines: 5} };
  var res = stream.PassThrough();
  var next = function(){};

  res.on('data', function(){
    x++; // This isn't incremented with empty logs ie: Travis
  });

  res.on('end', function(){
    t.ok(true, 'The end event was emitted');
  });

  api.showLog(req, res, next);
});


test('teardown', function(t){
  setImmediate(function() {
    process.exit();
  });
  t.end();
});
