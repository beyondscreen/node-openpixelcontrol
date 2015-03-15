# openpixelcontrol-stream ![build-status](https://api.travis-ci.org/raspberry-node/node-openpixelcontrol.svg)

stream-based implementation of the [openpixelcontrol][]-protocol.
Provides a protocol-parser and a client-implementation.

## installation

    npm install openpixelcontrol-stream

## usage example

```javascript
var ParseStream = require('openpixelcontrol').OpcParseStream,
    net = require('net'),
    ws281x = require('rpi-ws281x-native');


var server = net.createServer(function(conn) {
    var parser = new ParseStream({
        channel: 1,
        dataFormat: ParseStream.DataFormat.UINT32_ARRAY
    });

    parser.on('setpixelcolors', function(data) {
        ws281x.render(data);
    });

    conn.pipe(parser);
});

ws281x.init(100);
server.listen(7890);
```

[openpixelcontrol]: http://openpixelcontrol.org/
