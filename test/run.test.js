'use strict';

var test = require("tap").test;

var run = require('../lib/run.js');

var testRun;
//                    Construct!
// - - - - - - - - - - - - - - - - - - - - - - - - - 
test('Test successfully creating a run', t => {
  t.plan(4);

  testRun = run({
    "id":"default.sleep5",
    "command": "sleep 5 && echo 'Run Finished'"
  });
  
  t.ok(testRun, 'The test object should exist');
  t.ok(testRun.id, 'The run should have an id');
  t.type(testRun.created, 'number', 'The run should not have an started time');
  t.equal(testRun.completed, null, 'The run should not have an completed time');
});

test('Test successfully starting a run', t => {
  t.plan(3);
  t.equal(testRun.started, null, 'The run should not have an started time');
  t.type(testRun.duration(), 'number', 'The run lenght should be a number');
  testRun.start();
  t.type(testRun.started, 'number', 'The run should have an started time');
});

test('Test successfully completing a run', t => {
  t.plan(4);
  t.equal(testRun.completed, null, 'The run should not have an completed time');
  testRun.complete(0);
  t.type(testRun.duration(), 'number', 'The run length should be a number');
  t.type(testRun.completed, 'number', 'The run should have an completed time');
  t.equal(testRun.exitCode, 0, 'The run should have an exit code of 0');
});