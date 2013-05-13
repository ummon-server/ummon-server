var test = require("tap").test;

var ummon = require('../lib/ummon').create();
var api = require('../lib/api')(ummon);


//                    Construct!
// - - - - - - - - - - - - - - - - - - - - - - - - - 
test('Test successfully create the api object', function(t){
  t.ok(api, 'The api object should exist');
  t.ok(api.ps, 'The ps function should exist');
  t.ok(api.status, 'The status function should exist');
  t.ok(api.log, 'The log function should exist');
  t.ok(api.createTask, 'The createTask function should exist');

  t.end();
});

test('Show processes', function(t){
  t.plan(2);

  var req = {};
  var res = {};
  res.json = function(status, json) {
    t.type(json.count, 'number', 'The count should be a number');
    t.type(json.workers, 'object', 'The workers should be an object');
  };

  api.ps(req, res);
});


test('Create a task', function(t){
  t.plan(2);
  
  var req = { body: {"name":"test", "command":"echo hello", "trigger": {"time":"* * * * *"}}};
  var res = {};
  res.json = function(status, json) {
    t.equal(status, 200, 'The status should be 200');
    t.equal(json.message, 'Task default.test successfully created', 'The message should be correct');
  };
  
  api.createTask(req, res);
});


test('Show a task', function(t){
  t.plan(3);

  var req = { params: { "taskid":"default.test"} };
  var res = {};
  
  res.json = function(status, json) {
    t.equal(status, 200, 'The status should be 200');
    t.equal(json.task.name, 'test', 'The task name should be test');
    t.equal(json.task.command, 'echo hello', 'The task command should be echo');
  };

  api.getTask(req, res);
});


test('Update a task', function(t){
  t.plan(3);

  var req = { params: { "taskid":"default.test"}, body: {"name":"test", "collection":"default", "command":"echo goodbye", "trigger": {"time":"* * * * *"}} };
  var res = {};
  
  res.json = function(status, json) {
    t.equal(status, 200, 'The status should be 200');
    t.equal(json.task.name, 'test', 'The task name should be test');
    t.equal(json.task.command, 'echo goodbye', 'The task command should be echo');
  };

  api.updateTask(req, res);
});


test('Delete a task', function(t){
  t.plan(3);

  var req = { params: { "taskid":"default.test"} };
  var res = {};
  
  res.json = function(status) {
    t.equal(status, 200, 'The status should be 200');
    t.notOk(ummon.timers["default.test"], 'The timer should be deleted');
    t.notOk(ummon.tasks["default.test"], 'The task should be deleted');
  };

  api.deleteTask(req, res);
});


test('teardown', function(t){
  setImmediate(function() {
    process.exit();
  });
  t.end();
});