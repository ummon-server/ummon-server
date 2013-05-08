'use strict';


/**
 * Module dependencies.
 */
var assert = require('assert');
var restify = require('restify');


module.exports = function(url){
  var api = restify.createJsonClient({
    url: url,
    version: '*'
  });

  var client = {};

  client.ps = function(callback){
    api.get('/ps', function(err, req, res, result) {
      assert.ifError(err);
      
      callback(result);
    });
  };

  return client;
}