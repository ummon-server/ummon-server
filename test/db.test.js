var test = require("tap").test;

var fs = require('fs');
var rimraf = require('rimraf');

var ummon = require('../lib/ummon')({"tasksPath":false});
var db = require('../db')(ummon);

//                    Construct!
// - - - - - - - - - - - - - - - - - - - - - - - - -

test('Load collection information from a file', function(t){
  t.plan(11);

  db.loadCollectionFromFile('./fixtures/florida.tasks.json', function(err){
    t.notOk(err, 'There should be no error');
    t.equal(ummon.defaults['florida'].cwd, '/var/www/website/', 'The default settings for the florida collection are set');
    t.equal(ummon.tasks['florida.task1'].command, './update-apis', 'Task1 was created and with the right command');
    t.equal(ummon.tasks['florida.task1'].trigger.time, '*/10 * * * *', 'Task1 has the right trigger');
    t.equal(ummon.tasks['florida.task2'].command, './process-data', 'Task2 was created and with the right command');
    t.equal(ummon.tasks['florida.task2'].trigger.after, 'florida.task1', 'Task2 has the right trigger');
    t.equal(ummon.tasks['florida.task3'].command, './process-data', 'Task3 was created and with the right command');
    t.equal(ummon.tasks['florida.task3'].trigger.after, 'florida.task2', 'Task3 has the right trigger');
    t.equal(ummon.tasks['florida.task4'].command, './process-data', 'Task4 was created and with the right command');
    t.equal(ummon.tasks['florida.task4'].trigger.after, 'florida.task3', 'Task4 has the right trigger');
    t.notOk(ummon.tasks['florida.task4'].cwd, 'Task4 should not have a cwd listed');
  });
});


test('Load tasks from tasks dir', function(t){
  t.plan(7);

  ummon.config.tasksPath = './fixtures/tasks/';

  db.loadTasks(function(err){
    t.notOk(err, 'There should be no error');

    t.equal(ummon.defaults.autosample.cwd, '/var/www/website/', 'The collection defaults were properly loaded');
    ummon.getTask('autosample.task2', function(err, task){
      t.ok(task, 'The task flippn loaded');
      t.equal(task.cwd,'/var/www/website/', 'The collection defaults were properly loaded');
      t.equal(task.command,'./process-data', 'The task command is set');

      t.ok(ummon.tasks['palace.pizza'], 'Second config file loaded and first collection loaded');

      t.equal(ummon.dependencies["success"].subject('autosample.task1').references[0],'autosample.task2', 'Task dependencies were setup properly');
    });
  });
});


test('Save all tasks to files', function(t){
  t.plan(7);

  // Change tasks dir so it doesn't overwrite stuff
  ummon.config.tasksPath = './fixtures/saveTasks';

  db.saveTasks(function(err){
    t.notOk(err, 'There should be no error');
    t.ok(fs.existsSync('./fixtures/saveTasks/autosample.tasks.json'), 'The autosample collection was saved to file');
    t.ok(fs.existsSync('./fixtures/saveTasks/florida.tasks.json'), 'The florida collection was saved to file');
    t.ok(fs.existsSync('./fixtures/saveTasks/palace.tasks.json'), 'The palace collection was saved to file');

    var florida = require('./fixtures/saveTasks/florida.tasks.json');

    t.equal(florida.collection, 'florida', 'The collection name was saved');
    t.ok(florida.tasks.task1, 'There is a task one');
    t.equal(florida.tasks.task3.trigger.after, 'florida.task2', 'Task3\'s trigger references task2');
  });
});


test('teardown', function(t){
  setImmediate(function() {
    rimraf('./fixtures/saveTasks', function(err) {
      process.exit();
    });
  });
  t.end();
});
