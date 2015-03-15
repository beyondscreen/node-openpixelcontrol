var ReadableStream = require('stream').Readable,
    util = require('util');


/**
 * streaming client-interface for the openpixelcontrol-protocol.
 * For protocol-details see http://openpixelcontrol.org/
 *
 *
 *
 * @constructor
 */
function OpcClientStream(options) {
    ReadableStream.call(this);

    this.stream = this;
}
util.inherits(OpcClientStream, ReadableStream);

/**
 * @enum {number}
 */
OpcClientStream.Command = {
    SETPIXELCOLORS: 0x00,
    SYSEX: 0xff
};


/**
 * @param {number} channel
 * @param {OpcClientStream.Command} command
 * @param {Buffer} data
 *
 * @return {Buffer}
 */
OpcClientStream.createMessage = function(channel, command, data) {
    var msg = new Buffer(4 + data.length);

    msg.writeUInt8(channel, 0, true);
    msg.writeUInt8(command, 1, true);
    msg.writeUInt16BE(data.length, 2, true);

    data.copy(msg, 4);

    return msg;
};


/**
 * send a setPixelColors-message.
 *
 * @param {number} channel
 * @param {Buffer | Uint32Array} data  pixel-data. Either a Buffer with a
 *            single byte per color-channel ([r0, g0, b0, r1, g1, b1, ...]) or
 *            an Uint32Array with an uint32 per pixel (format 0x00rrggbb)
 */
OpcClientStream.prototype.setPixelColors = function(channel, data) {
    if(data instanceof Uint32Array) {
        var tmp = new Buffer(3*data.length);
        for(var i=0; i<data.length; i++) {
            var rgb = data[i];

            tmp.writeUInt8((rgb>>16) & 0xff, 3*i);
            tmp.writeUInt8((rgb>>8) & 0xff, 3*i+1);
            tmp.writeUInt8(rgb & 0xff, 3*i+2);
        }

        data = tmp;
    }

    var msg = OpcClientStream.createMessage(
            channel, OpcClientStream.Command.SETPIXELCOLORS, data);

    this.push(msg);
};


/**
 * send a sysex-message.
 *
 * @param {number} channel  channel-number
 * @param {number} systemId  16-bit integer indicating the systemId to be sent
 * @param {Buffer} data  the data to be sent.
 */
OpcClientStream.prototype.sysex = function(channel, systemId, data) {
    var buffer = new Buffer(2 + data.length), msg;

    buffer.writeUInt16BE(systemId, 0, true);
    data.copy(buffer, 2);

    msg = OpcClientStream.createMessage(
        channel, OpcClientStream.Command.SYSEX, buffer);

    this.push(msg);
};

/**
 * required to implement for readable-streams.
 * Doesn't do anything as data is only pushed from other API-methods
 * @private
 */
OpcClientStream.prototype._read = function() {};

module.exports = OpcClientStream;