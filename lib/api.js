module.exports = function(ummon){
  var api = {};
  

  /**
   * Ummon Status
   */
  api.status = function(req, res) {
    res.json(200,'status');
  };


  /**
   * What tasks are running
   */
  api.ps = function(req, res){
    var pids = Object.keys(ummon.workers);

    res.json(200, {
      "count":pids.length,
      "workers": pids
    });
  };


  /**
   * Send the logs!
   */
  api.log = function(req, res){
    res.json(200, 'log');
  };


  api.showTask = function(req, res){
    var p = req.params;
    if (!ummon.collections[p.collection]) {
      res.json(404, "Collection "+p.collection+"not found");
    }
    if (!ummon.collections[p.collection].tasks[p.task]) {
      res.json(404, "Task not found!");
    }
    
    res.json(200, {"task":ummon.collections[p.collection].tasks[p.task]});
  };


  /**
   * Create a task and add it to a collection
   *
   * Accepts:
   * 
   *     {
   *        "name":"hello",
   *        "command": "echo Hello;",
   *        "trigger": {
   *          "time": "* * * * *"
   *        }
   *      }
   */
  api.createTask = function(req, res){
    var task = ummon.createTask(req.body);

    res.json(200, {"message":"Task "+task.name+" successfully created in the "+task.collection+" collection", "task":task});
  };

  
  api.updateTask = function(req, res){
    var p = req.params;
    var t = req.body;

    if (!ummon.collections[p.collection]) {
      res.json(404, "Collection "+p.collection+"not found");
    }
    if (!ummon.collections[p.collection].tasks[p.task]) {
      res.json(404, "Task not found!");
    }

    t.collection = p.collection;
    t.name = p.task;

    var task = ummon.updateTask(t);

    res.json(200, {"message":"Task "+task.name+" successfully updated in the "+task.collection+" collection", "task":task});
  };


  api.deleteTask = function(req, res){
    var p = req.params;
    
    if (!ummon.collections[p.collection]) {
      res.json(404, "Collection "+p.collection+"not found");
    }
    if (!ummon.collections[p.collection].tasks[p.task]) {
      res.json(404, "Task not found!");
    }

    ummon.deleteTask(p.collection, p.task);

    res.json(200, {"message":"Task "+p.task+" successfully deleted in the "+p.collection+" collection"});
  };

  return api;
};