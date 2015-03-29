var ParseStream = require('../lib/opc-parse-stream'),
    net = require('net'),
    ws281x = require('rpi-ws281x-native');


var server = net.createServer(function(socket) {
    var parser = new ParseStream({
        channel: 1,
        dataFormat: ParseStream.DataFormat.UINT32_ARRAY
    });

    parser.on('setpixelcolors', function(data) {
        ws281x.render(data);
    });

    socket.pipe(parser);
});

ws281x.init(100);
server.listen(7890);