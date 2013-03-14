domain-middleware [![Build Status](https://secure.travis-ci.org/fengmk2/domain-middleware.png)](http://travis-ci.org/fengmk2/domain-middleware)
=======

![logo](https://raw.github.com/fengmk2/domain-middleware/master/logo.png)

`uncaughtException` middleware for connect, base on `domain` module.

Try to make a better [connect-domain](https://github.com/baryshev/connect-domain) module.

* jscoverage: [100%](http://fengmk2.github.com/coverage/domain-middleware.html)

## Install

```bash
$ npm install domain-middleware
```

## Usage

```js
var domain = require('domain-middleware');
var connect = require('connect');

var app = connect()
.use(domain())
.use(function(req, res){
  if (Math.random() > 0.5) {
    foo.bar();
  }
  setTimeout(function() {
    if (Math.random() > 0.5) {
      throw new Error('Asynchronous error from timeout');
    } else {
      res.end('Hello from Connect!');
    }
  }, 100);
  setTimeout(function() {
    if (Math.random() > 0.5) {
      throw new Error('Mock second error');
    }
  }, 200);
})
.use(function(err, req, res, next) {
  res.end(err.message);
});

app.listen(1984);
```

## License 

(The MIT License)

Copyright (c) 2013 fengmk2 &lt;fengmk2@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.