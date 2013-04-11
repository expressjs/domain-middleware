# connect with cluster and domain example

* Master: dispatch.js
* Worker: worker.js
* Your application logic: app.js

## Run

```bash
$ node example/connect_with_cluster/dispatch.js
```

## Test

```bash
$ curl localhost:1337/asycerror
domainThrown: true
ReferenceError: foo is not defined
    at Object._onTimeout (/Users/mk2/git/domain-middleware/example/connect_with_cluster/app.js:28:11)
    at Timer.list.ontimeout (timers.js:101:19)
```
