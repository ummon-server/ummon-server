var test = require('tap').test;
var ummon = require('..')({pause:true, autoSave:false});


test('Create a task', function (t) {
  t.plan(2);

  ummon.createTask({
    collection: 'science', 
    name: 'nye', 
    command: 'echo "The science guy!"',
    trigger: '* * * * *'
  }, function (err, task) {
    t.ifError(err, 'No error returned to task creation callback');
    t.equal(task.trigger.time, '* * * * *', 'Task trigger set as it should be');
  });
});

test('Update a task', function (t) {
  t.plan(2);

  ummon.updateTask('science.nye', {
    trigger: '5 * * * *'
  }, function (err, task) {
    t.ifError(err, 'No error returned to task update callback');
    t.equal(task.trigger.time, '5 * * * *', 'Task trigger set as it should be');
  });
});

test('teardown', function(t){
  setImmediate(function() {
    process.exit();
  });
  t.end();
});
