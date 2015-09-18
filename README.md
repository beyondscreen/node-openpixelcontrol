# openpixelcontrol-stream ![build-status](https://api.travis-ci.org/raspberry-node/node-openpixelcontrol.svg)

stream-based implementation of the [openpixelcontrol][]-protocol.
Provides a protocol-parser and a client-implementation.

## installation

    npm install openpixelcontrol-stream

## usage example

### openpixelcontrol server

This will run an openpixelcontrol server on the default port (7890) and send
received data to the `rpi-ws281x-native` module for output to a strip of
ws2812-leds.

```javascript
var ParseStream = require('openpixelcontrol-stream').OpcParseStream,
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


### openpixelcontrol client

A basic client connecting to an openpixelcontrol-server and running an
animation there.

```javascript
var ClientStream = require('openpixelcontrol-stream').OpcClientStream,
    net = require('net');

var NUM_LEDS = 100,
    OPC_CHANNEL = 0;

var client = new ClientStream();

// connect to openpixelcontrol-server at `192.168.1.42:7890`
var socket = net.createConnection(7890, '192.168.1.42', function() {
    client.pipe(socket);

    run();
});

function run() {
    // create a typed-array for color-data
    var data = new Uint32Array(NUM_LEDS);

    // setup an animation-loop at 10FPS
    setInterval(function () {
        // ... update colors in `data` ...

        client.setPixelColors(OPC_CHANNEL, data);
    }, 100);
}

```

[openpixelcontrol]: http://openpixelcontrol.org/
