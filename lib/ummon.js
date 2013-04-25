'use strict';

/**
 * Module dependencies.
 */

var //fs = require('fs'),
    //path = require('path'),
    // _ = require('underscore'),
    //moment = require('moment'),
    winston = require('winston');

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

function Ummon (options) {
  if (!options) { options = {}; }

  var self = this;

  self.tasks = {};
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
 * Add task to queue
 */
// Ummon.prototype.addTasks = function(tasks){
//   var self = this;
//   for (var name in tasks) {
//     self.addTask.call(self, name, tasks[name]);
//   }
// };
