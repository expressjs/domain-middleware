/*!
 * domain-middleware - lib/domain.js
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 */

var domain = require('domain');

module.exports = function () {
  return function domainMiddleware(req, res, next) {
    var d = domain.create();
    d.on('error', function (err) {
      // Once a domain is disposed, further errors from the emitters in that set will be ignored.
      // d.dispose();
      
      d._throwErrorCount = (d._throwErrorCount || 0) + 1;
      if (d._throwErrorCount > 1) {
        console.error('[domain-middleware] %s %s throw error %d times', req.method, req.url, d._throwErrorCount);
        console.error(err);
        return;
      }
      next(err);
    });

    d.run(next);
  };
};
