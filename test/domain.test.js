/*!
 * domain-middleware - test/domain.test.js
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */
"use strict";


var sinon = require("sinon");

var chai = require('chai')
chai.config.includeStack = true; // defaults to false
var expect = chai.expect;
chai.use( require('sinon-chai') );
var EventEmitter = require('events').EventEmitter;

var cluster = require('cluster');
var express = require('express');

var domainMiddleware = require('../');

var request = require('supertest');

describe('domain middleware', function () {


  describe('parameters check', function() {

    it('should detect missing server', function() {
      var tempfn = function() { domainMiddleware( { /* missing server param */ } ); };
      expect( tempfn).to.throw(Error, 'server required!');
    });

  });


  describe('when installed on an express app', function() {
    var setupTestServer;
    var app, server;

    // mock a server
    beforeEach(function() {
      server = new EventEmitter();
      server.close = sinon.stub();
    });

    // mock being a cluster worker
    beforeEach(function() {
      cluster.worker = new EventEmitter();
      cluster.worker.disconnect = sinon.stub();
    });
    afterEach(function () {
      delete cluster.worker;
    });

    beforeEach(function() {
      // offering a function allows tests to change env / options prior to instantiating the test server
      setupTestServer = function(options) {
        options = options || {};

        options.killTimeout = options.killTimeout || 1000;
        options.server = options.server || server;

        app = express();

        app.use(domainMiddleware( options ));

        app.use('/public', express.static(__dirname + '/fixtures'));

        app.get('/sync_error', function (req, res) {
          throw new Error('sync_error');
        });

        app.get('/async_error', function (req, res) {
          process.nextTick(function () {
            ff.foo();
          });
        });

        app.get('/async_error_twice', function (req, res) {
          setTimeout(function () {
            ff.foo();
          }, 100);
          setTimeout(function () {
            bar.bar();
          }, 200);
        });

        app.get('/async_error_thrice', function (req, res) {
          setTimeout(function () {
            ff.foo();
          }, 100);
          setTimeout(function () {
            bar.bar();
          }, 200);
          setTimeout(function () {
            hehe.bar();
          }, 300);
        });

        // fallback
        app.get('*', function (req, res) {
          res.end(req.url);
        });

        // four params error handler
        app.use(function errorHandler(err, req, res, next) {
          res.statusCode = 500;
          res.end(err.message);
        });
      };
    });

    describe('when processing requests with no errors', function() {

      it('should not interfere with a dynamic request', function (done) {
        setupTestServer();
        request(app)
        .get('/')
        .expect(200, done); // 200 OK
      });

      it('should not interfere with a static file request', function (done) {
        setupTestServer();
        request(app)
        .get('/public/foo.js')
        .expect('console.log(\'bar\');')
        .expect(200, done); // 200 OK
      });

    });

    describe('when processing requests throwing an error', function() {
      var mochaHandler;

      // Hack : Because `domain` will still throw `uncaughtException`, we need to hack for `mocha` test.
      // https://github.com/joyent/node/issues/4375
      // https://gist.github.com/4179636
      before(function () {
        mochaHandler = process.listeners('uncaughtException').pop();
      });
      after(function (done) {
        setTimeout(function () {
          // ...but be sure to re-enable mocha's error handler
          process.on('uncaughtException', mochaHandler);
          done();
        }, 2000);
      });

      describe('synchronous', function() {

        it('should catch and handle the error', function (done) {
          setupTestServer();
          request(app)
          .get('/sync_error')
          .expect('sync_error')
          .expect(500, done);
        });

        it('should not shutdown since it\'s not harmful', function (done) {
          setupTestServer();
          request(app)
          .get('/sync_error')
          .expect(500, function(err) {
            if(err) done(err);
            // additional tests
            expect( server.close ).not.to.have.been.called; // sane error, no need to shutdown the server
            expect( cluster.worker.disconnect ).not.to.have.been.called;
            done();
          });
        });

      });

      describe('asynchronous', function() {

        it('should catch and handle the error', function (done) {
          setupTestServer();
          request(app)
          .get('/async_error')
          .expect('ff is not defined')
          .expect(500, done);
        });

        it('should disconnect the worker', function (done) {
          setupTestServer();
          request(app)
          .get('/async_error')
          .expect(500, function(err) {
            if(err) done(err);
            expect( cluster.worker.disconnect ).to.have.been.calledOnce;
            done();
          });
        });

        it('should not attempt to close the server since worker.disconnect handle it', function (done) {
          request(app)
          .get('/async_error')
          .expect(500, function(err) {
            if(err) done(err);
            expect( server.close ).not.to.have.been.called;
            done();
          });
        });

        describe('when followed by other async errors', function() {

          it('should catch and handle the error even if a second async error is thrown', function (done) {
            setupTestServer();
            request(app)
            .get('/async_error_twice')
            .expect('ff is not defined')
            .expect(500, done);
          });

          it('should catch and handle the error even if two other async errors are thrown', function (done) {
            setupTestServer();
            request(app)
            .get('/async_error_thrice')
            .expect('ff is not defined')
            .expect(500, done);
          });

          it('should shutdown, and only once', function (done) {
            setupTestServer();
            request(app)
            .get('/async_error_thrice') // worst case
            .expect(500, function(err) {
              if(err) done(err);
              expect( cluster.worker.disconnect ).to.have.been.calledOnce;
              done();
            });
          });

        });

        describe('when the worker is already disconnected', function() {

          beforeEach(function() {
            setupTestServer();
            expect( cluster.worker.emit('disconnect') ).to.be.true; // true means there was at last one handler
            cluster.worker.disconnect = sinon.stub().throws("test - worker already disconnected");
          });

          it('should not attempt to disconnect the worker again', function (done) {
            request(app)
            .get('/async_error')
            .expect(500, function(err) {
              if(err) done(err);
              expect( cluster.worker.disconnect ).not.to.have.been.called;
              done();
            });
          });
        });

        describe('when not running in a cluster', function() {

          beforeEach(function() {
            delete cluster.worker;
          });

          it('should close the server', function (done) {
            setupTestServer();
            request(app)
            .get('/async_error')
            .expect(500, function(err) {
              if(err) done(err);
              expect( server.close ).to.have.been.calledOnce;
              done();
            });
          });

          describe('when the server is already closed', function() {

            beforeEach(function() {
              setupTestServer();
              expect( server.emit('close') ).to.be.true; // true means there was at last one handler
              server.close = sinon.stub().throws("test - server already closed");
            });

            it('should not attempt to close the server again', function (done) {
              request(app)
              .get('/async_error')
              .expect(500, function(err) {
                if(err) done(err);
                expect( server.close ).not.to.have.been.called;
                done();
              });
            });
          });
        });

        describe('when using a custom error callback', function() {
          var onErrorStub;

          beforeEach(function() {
            onErrorStub = sinon.spy(function(req, res, next, err, options) {
              // need to respond, but do it in a "testable" way
              res.statusCode = 333;
              res.end('foo');
            });
            setupTestServer({
              onError: onErrorStub
            });
          });

          it('should call it', function (done) {
            request(app)
            .get('/async_error')
            .expect('foo')
            .expect(333, function(err) {
              if(err) done(err);
              // additional tests
              expect( onErrorStub ).to.have.been.calledOnce;
              done();
            });
          });

          it('should not call server close or cluster disconnect in this case', function (done) {
            request(app)
            .get('/async_error')
            .expect('foo')
            .expect(333, function(err) {
              if(err) done(err);
              expect( server.close ).not.to.have.been.called; // up to the custom callback to do it if needed
              expect( cluster.worker.disconnect ).not.to.have.been.called; // idem
              done();
            });
          });

        });
      });
    });
  });
});
