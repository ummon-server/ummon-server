/*!
 * Module Dependancies
 */

var path = require('path');
var fs = require('fs');
var _ = require('underscore');


/**
 * Load the config from defaults, user provided config and any config items 
 * passed directly to the ummon constructor
 * 
 * @param  {Object} options   An object with a path to a config file to load
 * @return {Object}         
 */
exports.loadConfig = function(options){
  // Load config
  var defaults = require(path.join(__dirname, '../config/config.defaults.json')); // Load config.defaults.json
  var config;
  
  if (options.configPath) {
    var configPath = path.normalize(options.configPath);
    config = (fs.existsSync(configPath)) ? require(configPath) : {};
  }

  return _.extend(defaults, config, options);
}

exports.pidPath = function(options) {
  return path.join(options.pids.path,options.pids.file)
}