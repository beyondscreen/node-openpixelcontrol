var ClientStream = require('../lib/opc-client-stream'),
    net = require('net');

var opts = require('nomnom')
    .options({
        host: {
            position: 0,
            required: true,
            help: 'host'
        },
        port: {
            abbr: 'p',
            default: 7890,
            help: 'port number'
        },
        channel: {
            abbr: 'c',
            default: 0,
            help: 'OPC channel'
        }
    }).parse();


var socket = net.createConnection(opts.port, opts.host, function() {
    var client = new ClientStream();

    client.pipe(socket);

    var offset = 0, count = 27;
    var data = new Uint32Array(count);
    setInterval(function () {
        for (var i = 0; i < count; i++) {
            data[i] = colorwheel((offset + i) % 256);
        }

        client.setPixelColors(opts.channel, data);
        offset = (offset + 1) % 256;
    }, 100);
});


// rainbow-colors, taken from http://goo.gl/Cs3H0v
function colorwheel(pos) {
    pos = 255 - pos;
    if (pos < 85) { return rgb2Int(255 - pos * 3, 0, pos * 3); }
    else if (pos < 170) { pos -= 85; return rgb2Int(0, pos * 3, 255 - pos * 3); }
    else { pos -= 170; return rgb2Int(pos * 3, 255 - pos * 3, 0); }
}

function rgb2Int(r, g, b) {
    return ((r & 0xff) << 16) + ((g & 0xff) << 8) + (b & 0xff);
}