/*!
 * domain-middleware - lib/domain.js
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 */

var cluster = require('cluster');
var domain = require('domain');


/**
 * Domain middleware, recommended to be used with a `cluster` in production env.
 *
 * @param {Object} options
 * @param {HttpServer} options.server - we need to close it and stop taking new requests.
 * @param {Number} options.exitCode - exit code to use, default is 1
 * @param {Number} options.killTimeout - worker suicide timeout, default is 30 seconds.
 * @param {Function(req, res, next, err, options)} options.onError - the function executed on domain error. Default to best practices.

 * @return {Function(req, res, next)} an express/connect middleware
 */
module.exports = function createMiddleware(options) {

  options = options || {};

  // check param
  options.killTimeout = options.killTimeout || 30000;
  options.onError = options.onError || onErrorDefault;
  options.exitCode = options.exitCode || 1;

  if (!options.server) {
    throw new Error('server required!');
  }

  // internal vars, stored in options
  options._workerIsDisconnected = false;
  options._serverIsClosed = false;

  // monitor worker status to avoid disconnecting it twice
  if (cluster.worker)
    cluster.worker.on('disconnect', function() {
      options._workerIsDisconnected = true;
    });

  // monitor server status to avoid closing it twice
  if (options.server)
    options.server.on('close', function() {
      options._serverIsClosed = true;
    });

    return function domainMiddleware(req, res, next) {

    var d = domain.create();
    d.add(req);
    d.add(res);

    d.on('error', function (err) {
      d._throwErrorCount = (d._throwErrorCount || 0) + 1;
      if (d._throwErrorCount > 1) {
        console.error('[domain-middleware] %s %s threw error %d times', req.method, req.url, d._throwErrorCount);
        console.error(err);
        return;
      }

      options.onError(req, res, next, err, options);
    });

    res.locals.domain = d;

    d.run(next);
  };
};


function onErrorDefault(req, res, next, err, options) {

  // Must let current connection close.
  res.setHeader('Connection', 'close');
  next(err);

  // make sure we close down within `options.killTimeout` seconds
  var killtimer = setTimeout(function () {
    console.log('[%s] [worker:%s] kill timeout, exit now.', new Date(), process.pid);
    if (process.env.NODE_ENV === 'domain_middleware_unit_test') return;

    process.exit(options.exitCode);
  }, options.killTimeout);

  // But don't keep the process open just for that!
  // If there is no more io waiting, just let process exit normally.
  if (typeof killtimer.unref === 'function') {
    // only worked on node 0.10+
    killtimer.unref();
  }

  if(options.server
    && !cluster.worker // if a cluster worker, servers will be closed automatically, it's wrong to do it manually
    && !options._serverIsClosed) {
    try {
      options.server.close();
      console.warn('[%s] [worker:%s] closed server.',
        new Date(), process.pid);
    } catch (er2) {
      // oh well, not much we can do at this point.
      console.error('[%s] [worker:%s] Error while closing the server!\n%s',
        new Date(), process.pid, er2.stack);
    }
  }

  if (cluster.worker
    && !options._workerIsDisconnected) {
    try {
      // Let close all servers, die and let the master know we're dead.
      // The master should then will fork a new worker.
      cluster.worker.disconnect();
      console.warn('[%s] [worker:%s] disconnected worker.',
        new Date(), process.pid);
    } catch (er2) {
      // oh well, not much we can do at this point.
      console.error('[%s] [worker:%s] Error while disconnecting the worker!\n%s',
        new Date(), process.pid, er2.stack);
    }
  }

}
