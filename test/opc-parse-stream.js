var expect = require('expect.js'),
    sinon = require('sinon'),
    assert = require('assert');

describe('opc-parser', function() {
    var OpcParseStream = require('../lib/opc-parse-stream');

    function createOpcMessage(channel, command, data) {
        assert(~~channel === channel);
        assert(~~command === command);
        assert(Buffer.isBuffer(data));

        var msg = new Buffer(4 + data.length);
        msg.writeUInt8(channel, 0, true);
        msg.writeUInt8(command, 1, true);
        msg.writeUInt16BE(data.length, 2, true);

        data.copy(msg, 4);

        return msg;
    }


    describe('basics', function() {
        it('should exist', function() {
            expect(OpcParseStream).to.be.a('function');
        });

        it('should inherit from WritableStream', function() {
            var stream = require('stream');

            expect(new OpcParseStream()).to.be.a(stream.Writable);
        });
    });

    describe('data handling', function() {
        var renderer, parser;

        beforeEach(function() {
            renderer = sinon.spy();
            parser = new OpcParseStream({
                channel: 7,
                systemId: 0x0042,
                dataFormat: OpcParseStream.DataFormat.UINT32_ARRAY
            });

            parser.on('setpixelcolors', renderer);
        });

        describe('streaming - handle partial messages', function() {
            it('should wait for the complete message', function() {
                // fragmented message for 3 LEDs: 0xffffff, 0x0000ff, 0x00ff00
                var fragments = [
                    // channel, command, length MSB
                    new Buffer([0x00, OpcParseStream.Commands.SETPIXELCOLORS, 0x00]),
                    // length LSB, data[0-1]
                    new Buffer([0x09, 0xff, 0xff]),
                    // data[2-4]
                    new Buffer([0xff, 0x00, 0x00]),
                    // data[5-9]
                    new Buffer([0xff, 0x00, 0xff, 0x00])
                ];

                parser.write(fragments[0]);
                for(var i=1; i<4; i++) {
                    expect(renderer.called).to.be(false);
                    parser.write(fragments[i]);
                }

                expect(renderer.called).to.be(true);
            });

            it('should hold data of a upcoming message', function() {
                // two different messages, split unevenly so the rest of
                // the first has to be kept back
                var fragments = [
                    new Buffer([0x00, 0x00, 0x00, 0x03, 0xaa, 0xbb, 0xcc,
                                0x07, 0x00]),
                    new Buffer([            0x00, 0x03, 0xaa, 0xcc, 0xbb]),
                    new Buffer([0x00, 0x00, 0x00, 0x03, 0xcc, 0xbb, 0xaa])
                ];

                parser.write(fragments[0]);
                sinon.assert.calledOnce(renderer);

                parser.write(fragments[1]);
                sinon.assert.calledTwice(renderer);

                parser.write(fragments[2]);
                sinon.assert.calledThrice(renderer);
                var renderCall = renderer.getCall(2);

                sinon.assert.calledWith(
                    renderCall,
                    sinon.match(function(arr) { return arr[0] = 0xccbbaa; }))
            });
        });

        describe('streaming - multiple messages at once', function() {
            it('should handle multiple messages', function() {
                var msg = Buffer.concat([
                    createOpcMessage(0x00, OpcParseStream.Commands.SETPIXELCOLORS,
                        new Buffer([0xff,0xee,0xdd])),
                    createOpcMessage(0x00, OpcParseStream.Commands.SETPIXELCOLORS,
                        new Buffer([0x11,0x22,0x33]))
                ]);

                parser.write(msg);
                expect(renderer.callCount).to.be(2);

                sinon.assert.calledWith(
                    renderer.getCall(1),
                    sinon.match.instanceOf(Uint32Array)
                        .and(sinon.match.has('length', 1))
                        .and(sinon.match(function(arr) {
                            return arr[0] === 0x112233;
                        }, 'correct color-values'))
                );
            });
        });

        describe('protocol - setPixelColors', function() {
            it('should accept broadcast setpixelcolor-messages', function() {
                var colorData = new Buffer([0xff, 0x00, 0x00, 0x00, 0xff, 0x00]);

                parser.write(createOpcMessage(0, OpcParseStream.Commands.SETPIXELCOLORS, colorData));
                expect(renderer.called).to.be(true);

                sinon.assert.calledWith(
                    renderer,

                    sinon.match.instanceOf(Uint32Array)
                        .and(sinon.match.has('length', 2))
                        .and(sinon.match(function(arr) {
                            return arr[0] === 0xff0000
                                && arr[1] === 0x00ff00;
                        }, 'correct color-values'))
                );
            });

            it('should accept targeted setpixelcolor-messages', function() {
                var colorData = new Buffer([0xff, 0x00, 0x00, 0x00, 0xff, 0x00]);
                parser.write(createOpcMessage(7, OpcParseStream.Commands.SETPIXELCOLORS, colorData));

                expect(renderer.called).to.be(true);
            });

            it('should ignore values for other channels', function() {
                var colorData = new Buffer([0xff, 0xff, 0xff]);

                parser.write(createOpcMessage(4, OpcParseStream.Commands.SETPIXELCOLORS, colorData));
                expect(renderer.called).to.be(false);
            });

            it('should ignore sysex-messages', function() {
                parser.write(createOpcMessage(0, OpcParseStream.Commands.SYSEX,
                        new Buffer([0x00, 0x42, 0x00, 0x00])));

                expect(renderer.called).to.be(false);
            });
        });

        describe('protocol - sysex', function() {
            var sysexHandler;

            beforeEach(function() {
                sysexHandler = sinon.spy();
                parser.on('sysex', sysexHandler);
            });

            it('should skip too short messages', function() {
                var msg = new Buffer([0x00, 0x42, 0x11]);
                parser.write(createOpcMessage(0, OpcParseStream.Commands.SYSEX, msg));

                expect(sysexHandler.called).to.be(false);
            });

            it('should skip messages with wrong messageId', function() {
                var msg = new Buffer([0x00, 0x01, 0x11, 0x22]);
                parser.write(createOpcMessage(0, OpcParseStream.Commands.SYSEX, msg));

                expect(sysexHandler.called).to.be(false);
            });

            it('should handle sysex-messages', function() {
                // sysex-message: systemId:0x0042, commandId:Uint16BE, content
                var msg = new Buffer([0x00, 0x42, 0x11, 0x22, 0xaa, 0xbb]);
                parser.write(createOpcMessage(0, OpcParseStream.Commands.SYSEX, msg));

                expect(sysexHandler.called).to.be(true);
                sinon.assert.calledWith(
                    sysexHandler,

                    sinon.match(0x1122),
                    sinon.match.instanceOf(Buffer)
                        .and(sinon.match.has('length', 2))
                        .and(sinon.match(function(arr) {
                            return arr[0] === 0xaa
                                && arr[1] === 0xbb;
                        }, 'correct sysex-payload'))
                );
            });
        });
    });

    describe('data-format', function() {
        it('should handle buffer-format', function() {
            var renderer = sinon.spy();
            var parser = new OpcParseStream();

            parser.on('setpixelcolors', renderer);

            var colorData = new Buffer([0xff, 0x00, 0x00, 0x00, 0xcc, 0x00]);
            parser.write(createOpcMessage(0, OpcParseStream.Commands.SETPIXELCOLORS, colorData));
            expect(renderer.called).to.be(true);

            sinon.assert.calledWith(
                renderer,

                sinon.match.instanceOf(Buffer)
                    .and(sinon.match.has('length', 6))
                    .and(sinon.match(function(arr) {
                        return arr.readUInt8(0) === 0xff
                            && arr.readUInt8(4) === 0xcc;
                    }, 'correct color-values'))
            );
        });
    });
});