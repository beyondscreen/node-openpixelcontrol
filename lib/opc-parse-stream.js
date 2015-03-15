var util = require('util'),
    WritableStream = require('stream').Writable;

/**
 * A writable stream to act as a sink for the binary OpenPixelControl-protocol.
 * For protocol-details see http://openpixelcontrol.org/
 *
 * Channel and System-Id (for sysex-messages) can be configured using
 * `options.channel` and `options.systemId`.
 *
 * There are two options for the internal data-format that can be configured
 * with `options.dataFormat`:
 *
 *  - `OpcParseStream.DataFormat.BUFFER` (default): uses buffer-instances with
 *    3 byte per pixel (RGB-order). These are a bit smaller and more efficient
 *    than using Uint32Arrays, as the data can be directly forwarded from the
 *    network-packets.
 *
 *  - `OpcParseStream.DataFormat.UINT32_ARRAY`: uses an unsined 32-bit integer
 *     per pixel in an Uint32Array. Data format is `0x00rrggbb`.
 *
 *
 * There are two ways how this can be used this in your project:
 *
 *  - using events: The OpcParseStream will emit 'setpixelcolors' and
 *    'sysex'-events whenever data has been received, the data-format for
 *    pixel-data depends on the `options.dataFormat` setting.
 *
 *  - extend: you can also inherit from this prototype and override the
 *    `setPixelColors()` and `sysex()` method to handle the data. The
 *    default-implementation provided here just emits the events mentioned
 *    above.
 *
 * @param {OpcParseStream.Options} options
 * @extends {WritableStream}
 * @constructor
 */
function OpcParseStream(options) {
    WritableStream.call(this);

    options = options || {};

    this._pushback = null;

    /**
     * @type {OpcParseStream.DataFormat}
     */
    this.dataFormat = options.dataFormat || OpcParseStream.DataFormat.BUFFER;

    /**
     * @type {number}
     */
    this.channel = ~~options.channel || 0;

    /**
     * @type {number}
     */
    this.systemId = ~~options.systemId || 0xffff;
}
util.inherits(OpcParseStream, WritableStream);


/**
 * @typedef {{
 *   channel: number,
 *   systemId: number,
 *   dataFormat: OpcParseStream.DataFormat
 * }}
 */
OpcParseStream.Options;


/**
 * @enum {string}
 */
OpcParseStream.DataFormat = {
    BUFFER: 'buffer',
    UINT32_ARRAY: 'uint32array'
};

/**
 * @enum {number}
 */
OpcParseStream.Commands = {
    SETPIXELCOLORS: 0x00,
    SYSEX: 0xff
};


/**
 * handle a setpixelcolors-command.
 *
 * @param {Uint32Array|Buffer} data  pixel-data, type depends on
 *                                   options.dataFormat
 */
OpcParseStream.prototype.setPixelColors = function(data) {
    this.emit('setpixelcolors', data);
};


/**
 * handle a parsed sysex-message.
 *
 * @param {number} commandId
 * @param {Buffer} data
 */
OpcParseStream.prototype.sysex = function(commandId, data) {
    this.emit('sysex', commandId, data);
};



// ---- PRIVATE
/**
 * @param {Buffer} buffer
 * @param {String} encoding
 * @param {function(Error?)} callback
 * @private
 */
OpcParseStream.prototype._write = function(buffer, encoding, callback) {
    var channel, command, length, data;

    if(encoding !== 'buffer') {
        // FIXME: add tests for error-handling
        return callback(new Error('expected data as Buffer'));
    }

    if(this._pushback) {
        buffer = Buffer.concat([this._pushback, buffer]);
        this._pushback = null;
    }

    if(buffer.length < 4) {
        this._pushback = buffer;

        return callback();
    }

    channel = buffer.readUInt8(0, true);
    command = buffer.readUInt8(1, true);
    length = buffer.readUInt16BE(2, true);

    // FIXME: handle edge-cases
    if(buffer.length < 4+length) {
        this._pushback = buffer;

        return callback();
    }

    if(buffer.length > 4+length) {
        this._pushback = buffer.slice(4+length);
    }

    data = buffer.slice(4, 4+length);

    this._handleOpcMessage(channel, command, data);

    callback();
};


/**
 * @private
 */
OpcParseStream.prototype._handleOpcMessage = function(channel, command, data) {
    // skip non-broadcast messages for other channels
    if(channel > 0 && channel !== this.channel) {
        return;
    }

    if(command === OpcParseStream.Commands.SETPIXELCOLORS) {
        this._handleSetPixelColorsMessage(data);
    }

    if(command === OpcParseStream.Commands.SYSEX) {
        // sysex-messages with less than 4bytes are considered invalid.
        // However, we don't throw an error here and simply ignore the packet.
        if(data.length < 4) {
            return;
        }

        this._handleSysExMessage(data);
    }
};


/**
 * @param {Buffer} data
 * @fires OpcParseStream#setpixelcolors
 * @private
 */
OpcParseStream.prototype._handleSetPixelColorsMessage = function(data) {
    if(this.dataFormat === OpcParseStream.DataFormat.BUFFER) {
        this.setPixelColors(data);
    } else {
        var pixelData = new Uint32Array(data.length/3);

        for(var i=0; i<pixelData.length; i++) {
            pixelData[i] = (
                  (data.readUInt8(3*i) << 16)
                | (data.readUInt8(3*i + 1) << 8)
                | (data.readUInt8(3*i + 2))
            );
        }

        this.setPixelColors(pixelData);
    }
};


/**
 * @param {Buffer} data
 * @private
 */
OpcParseStream.prototype._handleSysExMessage = function(data) {
    var systemId = data.readUInt16BE(0, true),
        sysexCommandId = data.readUInt16BE(2, true);

    if(systemId !== this.systemId) {
        return;
    }

    this.sysex(sysexCommandId, data.slice(4));
};

module.exports = OpcParseStream;