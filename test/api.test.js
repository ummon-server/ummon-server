var test = require("tap").test;

var stream = require('stream');

var ummon = require('../lib/ummon').create();
var api = require('../lib/api')(ummon);

//                    Construct!
// - - - - - - - - - - - - - - - - - - - - - - - - - 
test('Test successfully create the api object', function(t){
  t.ok(api, 'The api object should exist');
  t.ok(api.ps, 'The ps function should exist');
  t.ok(api.status, 'The status function should exist');
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
    t.type(json.workers, 'object', 'The workers should be an object');
  };

  api.ps(req, res, next);
});


test('Create a task', function(t){
  t.plan(2);
  
  var req = { body: {"name":"test", "command":"echo hello", "trigger": {"time":"* * * * *"}}};
  var res = {};
  var next = function(){};

  res.json = function(status, json) {
    t.equal(status, 200, 'The status should be 200');
    t.equal(json.message, 'Task default.test successfully created', 'The message should be correct');
  };
  
  api.createTask(req, res, next);
});


test('Show a task', function(t){
  t.plan(3);

  var req = { params: { "taskid":"default.test" } };
  var res = {};
  var next = function(){};

  res.json = function(status, json) {
    t.equal(status, 200, 'The status should be 200');
    t.equal(json.task.name, 'test', 'The task name should be test');
    t.equal(json.task.command, 'echo hello', 'The task command should be echo');
  };

  api.getTask(req, res, next);
});


test('Show tasks', function(t){
  t.plan(2);

  var req = { params: {} };
  var res = {};
  var next = function(){};
  
  res.json = function(status, json) {
    t.equal(status, 200, 'The status should be 200');
    console.log(json.tasks);
    t.equal(json.length, 1, 'showTasks returns 1 task');
  };

  api.getTasks(req, res, next);

});


test('Update a task', function(t){
  t.plan(3);

  var req = { params: { "taskid":"default.test"}, body: {"name":"test", "collection":"default", "command":"echo goodbye", "trigger": {"time":"* * * * *"}} };
  var res = {};
  var next = function(){};
  
  res.json = function(status, json) {
    t.equal(status, 200, 'The status should be 200');
    t.equal(json.task.name, 'test', 'The task name should be test');
    t.equal(json.task.command, 'echo goodbye', 'The task command should be echo');
  };

  api.updateTask(req, res, next);
});


test('Delete a task', function(t){
  t.plan(3);

  var req = { params: { "taskid":"default.test"} };
  var res = {};
  var next = function(){};
  
  res.json = function(status) {
    t.equal(status, 200, 'The status should be 200');
    t.notOk(ummon.timers["default.test"], 'The timer should be deleted');
    t.notOk(ummon.tasks["default.test"], 'The task should be deleted');
  };

  api.deleteTask(req, res, next);
});


test('Return a log', function(t){
  t.plan(2);
  var x = 0;
  var req = { params: { collection: 'default' } };
  var res = stream.PassThrough();
  var next = function(){};

  res.on('data', function(){
    x++;
  });

  res.on('end', function(){
    t.ok((x > 0), 'Data has been called');
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