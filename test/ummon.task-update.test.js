var test = require('tap').test;
var ummon = require('..')({pause:true, autoSave:false});


var timer;

test('Create a task', t => {
  t.plan(3);

  ummon.createTask({
    collection: 'science', 
    name: 'nye', 
    command: 'echo "The science guy!"',
    trigger: '* * * * *'
  }, (err, task) => {
    t.ifError(err, 'No error returned to task creation callback');
    t.equal(task.trigger.time, '* * * * *', 'Task trigger set as it should be');

    // Grab the timer for checking later
    timer = ummon.timers['science.nye'];
    t.equal(timer.cronTime.source, '* * * * *', 'Timer matches trigger');
  });
});

test('Update a task', t => {
  t.plan(4);

  ummon.updateTask('science.nye', {
    trigger: '5 * * * *'
  }, (err, task) => {
    t.ifError(err, 'No error returned to task update callback');
    t.equal(task.trigger.time, '5 * * * *', 'Task trigger set as it should be');
    t.equal(ummon.timers['science.nye'].cronTime.source, '5 * * * *', 'Timer matches trigger');

    // Check to make sure the timer we set earlier is no longer running
    t.ok(!timer.running, 'Old timer has been stopped');
  });
});


test('teardown', t => {
  setImmediate(() => {
    process.exit();
  });
  t.end();
});
