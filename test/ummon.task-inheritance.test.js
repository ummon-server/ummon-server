'use strict';

var test = require("tap").test;
var moment = require("moment");
var async = require("async");

var ummon = require('..')({pause:true, autoSave:false});

test('Create collections default values and retrieve a task that inherits them', t => {
  t.plan(2);
  ummon.defaults.science = { 'cwd': '/user/bill' };

  async.series([
    callback => { ummon.createTask({"collection":"science", "name":"nye","command": "echo \"The science guy!\"" }, callback); },
    callback => { ummon.createTask({"collection":"science", "cwd":"/user/neil","name":"tyson","command": "echo \"The space guy!\"" }, callback); },
  ], (err, results) => {
    t.notOk(results[0].cwd, 'The nye task shouldn\'t have its cwd set. It\'s in the collection defaults');
    t.equal(results[1].cwd, '/user/neil', 'The tyson task should override the collection defaults');
  });

});


test('Test getting a task that inherits global task settings', t => {
  t.plan(6);

  ummon.config.globalTaskDefaults = { env: {"NODE_ENV":"TEST" }};

  ummon.getTask('science.nye', (err, task) => {
    t.notOk(err, 'There is no error');
    t.ok(task, 'There is a task');
    t.equal(task.cwd, '/user/bill', 'Defaults are not set on the master task');
    t.notOk(ummon.tasks['science.nye'].env, 'The task is truly inheriting from globals');
    t.notOk(ummon.tasks['science.nye'].cwd, 'The task is truly inheriting from globals');
    t.equal(task.env.NODE_ENV, 'TEST', 'Global default are attached to the retrieved');
  })
})

test('teardown', t => {
  setImmediate(() => {
    process.exit();
  });
  t.end();
});
