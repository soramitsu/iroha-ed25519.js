"use strict";
/**
 * Copyright Soramitsu Co., Ltd. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
var buffer_1 = require("buffer");
var Module = require("./lib/ed25519.min.js");
exports.createKeyPair = function () {
    var pubKeyPtr = Module._malloc(32);
    var pubKey = new Uint8Array(Module.HEAPU8.buffer, pubKeyPtr, 32);
    var privKeyPtr = Module._malloc(32);
    var privKey = new Uint8Array(Module.HEAPU8.buffer, privKeyPtr, 32);
    Module._ed25519_create_keypair(privKeyPtr, pubKeyPtr);
    var result = {
        privateKey: buffer_1.Buffer.from(privKey),
        publicKey: buffer_1.Buffer.from(pubKey),
    };
    Module._free(pubKeyPtr);
    Module._free(privKeyPtr);
    return result;
};
exports.derivePublicKey = function (privateKey) {
    if (!buffer_1.Buffer.isBuffer(privateKey)) {
        throw new Error('Input arguments are not buffers!');
    }
    var privKeyPtr = Module._malloc(32);
    var privKey = new Uint8Array(Module.HEAPU8.buffer, privKeyPtr, 32);
    privKey.set(privateKey);
    var pubKeyPtr = Module._malloc(32);
    var pubKey = new Uint8Array(Module.HEAPU8.buffer, pubKeyPtr, 32);
    Module._ed25519_derive_public_key(privKeyPtr, pubKeyPtr);
    var result = buffer_1.Buffer.from(pubKey);
    Module._free(pubKeyPtr);
    Module._free(privKeyPtr);
    return result;
};
exports.sign = function (message, publicKey, privateKey) {
    if (!buffer_1.Buffer.isBuffer(message) || !buffer_1.Buffer.isBuffer(publicKey) || !buffer_1.Buffer.isBuffer(privateKey)) {
        throw new Error('Input arguments are not buffers!');
    }
    var msgLen = message.length;
    var msgPtr = Module._malloc(msgLen);
    var msg = new Uint8Array(Module.HEAPU8.buffer, msgPtr, msgLen);
    msg.set(message);
    var pubKeyPtr = Module._malloc(32);
    var pubKey = new Uint8Array(Module.HEAPU8.buffer, pubKeyPtr, 32);
    pubKey.set(publicKey);
    var privKeyPtr = Module._malloc(32);
    var privKey = new Uint8Array(Module.HEAPU8.buffer, privKeyPtr, 32);
    privKey.set(privateKey);
    var sigPtr = Module._malloc(64);
    var sig = new Uint8Array(Module.HEAPU8.buffer, sigPtr, 64);
    /*
      WARNING: 0 is passed to the _ed25519_sign as 4th argument due to an error in the EMSCRIPTEN.
      In case of EMSCRIPTEN fix and correct build, testcase will fail and this 0 will be removed from here.
    */
    Module._ed25519_sign(sigPtr, msgPtr, msgLen, 0, pubKeyPtr, privKeyPtr);
    var result = buffer_1.Buffer.from(sig);
    Module._free(msgPtr);
    Module._free(pubKeyPtr);
    Module._free(privKeyPtr);
    Module._free(sigPtr);
    return result;
};
exports.verify = function (signature, message, publicKey) {
    if (!buffer_1.Buffer.isBuffer(signature) || !buffer_1.Buffer.isBuffer(message) || !buffer_1.Buffer.isBuffer(publicKey)) {
        throw new Error('Input arguments are not buffers!');
    }
    var msgLen = message.length;
    var msgPtr = Module._malloc(msgLen);
    var msg = new Uint8Array(Module.HEAPU8.buffer, msgPtr, msgLen);
    msg.set(message);
    var pubKeyPtr = Module._malloc(32);
    var pubKey = new Uint8Array(Module.HEAPU8.buffer, pubKeyPtr, 32);
    pubKey.set(publicKey);
    var sigPtr = Module._malloc(64);
    var sig = new Uint8Array(Module.HEAPU8.buffer, sigPtr, 64);
    sig.set(signature);
    /*
      WARNING: 0 is passed to the _ed25519_verify as 4th argument due to an error in the EMSCRIPTEN.
      In case of EMSCRIPTEN fix and correct build, testcase will fail and this 0 will be removed from here.
    */
    var result = Module._ed25519_verify(sigPtr, msgPtr, msgLen, 0, pubKeyPtr) === 1;
    Module._free(msgPtr);
    Module._free(pubKeyPtr);
    Module._free(sigPtr);
    return result;
};
//# sourceMappingURL=index.js.map