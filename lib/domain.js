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
 * Domain middleware, please use with `cluster` in production env.
 * 
 * @param {Object} options
 *  - {HttpServer} server, we need to close it and stop taking new requests.
 *  - {Number} [killTimeout], worker suicide timeout, default is 30 seconds.
 * @return {Function(req, res, next)}
 */
module.exports = function createMiddleware(options) {
  options = options || {};
  options.killTimeout = options.killTimeout || 30000;
  if (!options.server) {
    throw new Error('server required!');
  }

  return function domainMiddleware(req, res, next) {
    var d = domain.create();
    d.add(req);
    d.add(res);
    d.on('error', function (err) {
      d._throwErrorCount = (d._throwErrorCount || 0) + 1;
      if (d._throwErrorCount > 1) {
        console.error('[domain-middleware] %s %s throw error %d times', req.method, req.url, d._throwErrorCount);
        console.error(err);
        return;
      }

      // Must let current connection close.
      res.setHeader('Connection', 'close');
      next(err);

      // make sure we close down within `options.killTimeout` seconds
      var killtimer = setTimeout(function () {
        console.log('[%s] [worker:%s] kill timeout, exit now.', new Date(), process.pid);
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
      }, options.killTimeout);

      // But don't keep the process open just for that!
      // If there is no more io waitting, just let process exit normally.
      if (typeof killtimer.unref === 'function') {
        // only worked on node 0.10+
        killtimer.unref();
      }

      // cluster mode
      if (cluster.worker) {
        try {
          // stop taking new requests.
          // because server could already closed, need try catch the error: `Error: Not running` 
          options.server.close();
          console.warn('[%s] [worker:%s] close server!', 
            new Date(), process.pid);

          // Let the master know we're dead.  This will trigger a
          // 'disconnect' in the cluster master, and then it will fork
          // a new worker.
          cluster.worker.disconnect();
          console.warn('[%s] [worker:%s] worker disconnect!', 
            new Date(), process.pid);
        } catch (er2) {
          // Usually, this error throw cause by the active connections after the first domain error,
          // oh well, not much we can do at this point.
          console.error('[%s] [worker:%s] Error on server close or worker disconnect!\n%s', 
            new Date(), process.pid, er2.stack);
        }
      }
    });

    d.run(next);
  };
};
