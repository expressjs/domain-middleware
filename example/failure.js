/*!
 * domain-middleware - exmaple/failure.js
 * Copyright(c) 2013 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 */

var http = require('http');
var connect = require('connect');
var domainMiddleware = require('../');

var keepAliveClient = http.request({
  host: 'www.google.com',
  path: '/index.html'
});

var server = http.createServer();
var app = connect()
.use(domainMiddleware({
  server: server,
  killTimeout: 3000,
}))
.use(function (req, res) {
  // process.domain.add(keepAliveClient)
  keepAliveClient.on('response', function (response) {
    foo.bar();
  });
  keepAliveClient.end();
})
.use(function(err, req, res, next) {
  res.end(err.message);
});

server.on('request', app);
server.listen(1984);