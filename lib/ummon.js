'use strict';

/**
 * Module dependencies.
 */

var //fs = require('fs'),
    //path = require('path'),
    // _ = require('underscore'),
    //moment = require('moment'),
    winston = require('winston');

var collection = require('./collection');
// var task = require('lib/task');

/**
 * Exports
 */
module.exports = ummon;

// Can decide on the api here
function ummon (options) {
  return new Ummon(options);
}
ummon.createServer = function(options){
  return new Ummon(options);
};

// Expose the constructor for potential inheritance
ummon.Ummon = Ummon;


/**
 * Ummon
 * 
 * @param {object} options configuration options
 */
function Ummon (options) {
  if (!options) { options = {}; }

  var self = this;

  // Create the default collection
  self.collections = {
    default: collection('default')
  };
  
  self.queue = [];
  
  self.log.transports.console.level = 'info';
}


/**
 * [log description]
 * @type {[type]}
 */
var log = Ummon.prototype.log = new winston.Logger({
  transports: [
    new winston.transports.Console({
      //handleExceptions: true
    })
  ],
  //exitOnError: false
});
log.cli();


/**
 * Add task to a queue
 *
 * This is a shorthand function which passes through to the specified collection
 */
Ummon.prototype.addTask = function(collection, taskName, task){
  var self = this;
  
  self.collections[collection].add(taskName, task);
};
