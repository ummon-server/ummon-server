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
   * What tasks are running
   */
  api.log = function(req, res){
    res.json(200, 'log');
  };


  /**
   * What tasks are running
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

  return api;
};