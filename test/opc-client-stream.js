var expect = require('expect.js'),
    sinon = require('sinon'),
    assert = require('assert');

var ReadableStream = require('stream').Readable,
    WritableStream = require('stream').Writable;


describe('opc-client-stream.js', function() {
    var OpcClientStream = require('../lib/opc-client-stream');

    it('exists and inherits from stream.Readable', function() {


        expect(OpcClientStream).to.be.a('function');
        expect(new OpcClientStream()).to.be.a(ReadableStream);
    });

    describe('protocol', function() {
        var clientStream, outputSpy;

        beforeEach(function () {
            outputSpy = sinon.spy();
            clientStream = new OpcClientStream();

            var outputStream = (function () {
                var s = new WritableStream();
                s._write = function (buffer, encoding, callback) {
                    outputSpy(buffer, encoding);
                    callback();
                };

                return s;
            }());

            clientStream.pipe(outputStream);
        });

        describe('setpixelcolors', function() {
            it('sends setpixelcolors-messages', function (done) {
                clientStream.setPixelColors(7, new Buffer([0xaa, 0xbb, 0xcc]));

                process.nextTick(function () {
                    expect(outputSpy.called).to.be(true);

                    sinon.assert.calledWith(
                        outputSpy,
                        // buffer
                        sinon.match(function (buf) {
                            return buf.readUInt8(0) === 0x07 // channel
                                && buf.readUInt8(1) === 0x00 // command
                                && buf.readUInt16BE(2) === 0x0003 // length
                                && buf.readUInt8(4) === 0xaa
                                && buf.readUInt8(5) === 0xbb
                                && buf.readUInt8(6) === 0xcc
                                ;
                        }),
                        // encoding
                        sinon.match('buffer')
                    );
                    done();
                });
            });

            it('handles Uint32Array-data', function(done) {
                var pixelData = new Uint32Array(2);
                pixelData.set([0xaabbcc, 0x112233]);

                clientStream.setPixelColors(7, pixelData);

                process.nextTick(function () {
                    expect(outputSpy.called).to.be(true);

                    sinon.assert.calledWith(
                        outputSpy,
                        // buffer
                        sinon.match(function (buf) {
                            return buf.readUInt8(0) === 0x07 // channel
                                && buf.readUInt8(1) === 0x00 // command
                                && buf.readUInt16BE(2) === 0x0006 // length
                                && buf.readUInt8(4) === 0xaa
                                && buf.readUInt8(5) === 0xbb
                                && buf.readUInt8(6) === 0xcc
                                && buf.readUInt8(7) === 0x11
                                && buf.readUInt8(8) === 0x22
                                && buf.readUInt8(9) === 0x33
                                ;
                        }),
                        // encoding
                        sinon.match('buffer')
                    );
                    done();
                });
            });
        });

        describe('sysex', function() {
            it('sends sysex-messages', function(done) {
                clientStream.sysex(7, 0x2342, new Buffer([0xaa, 0xbb, 0xcc]));

                process.nextTick(function() {
                    expect(outputSpy.called).to.be(true);

                    sinon.assert.calledWith(
                        outputSpy,
                        // buffer
                        sinon.match(function(buf) {
                            return buf.readUInt8(0) === 0x07 // channel
                                && buf.readUInt8(1) === 0xff // command
                                && buf.readUInt16BE(2) === 0x0005 // length
                                && buf.readUInt16BE(4) === 0x2342 // systemId
                                && buf.readUInt8(6) === 0xaa // payload...
                                && buf.readUInt8(7) === 0xbb
                                && buf.readUInt8(8) === 0xcc
                                ;
                        }, 'stuuff'),
                        // encoding
                        sinon.match('buffer')
                    );
                    done();
                });
            })
        });
    });
});