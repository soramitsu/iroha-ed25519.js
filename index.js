var Module = require('./lib/ed25519.min.js')

exports.createKeyPair = function () {
  var pubKeyPtr = Module._malloc(32)
  var pubKey = new Uint8Array(Module.HEAPU8.buffer, pubKeyPtr, 32)

  var privKeyPtr = Module._malloc(32)
  var privKey = new Uint8Array(Module.HEAPU8.buffer, privKeyPtr, 32)

  Module._ed25519_create_keypair(privKeyPtr, pubKeyPtr)

  var result = {
    publicKey: Buffer.from(pubKey),
    privateKey: Buffer.from(privKey)
  }

  Module._free(pubKeyPtr)
  Module._free(privKeyPtr)

  return result
}

exports.derivePublicKey = function (privateKey) {
  if (!Buffer.isBuffer(privateKey)) {
    throw new Error('Input arguments are not buffers!')
  }

  var privKeyPtr = Module._malloc(32)
  var privKey = new Uint8Array(Module.HEAPU8.buffer, privKeyPtr, 32)
  privKey.set(privateKey)

  var pubKeyPtr = Module._malloc(32)
  var pubKey = new Uint8Array(Module.HEAPU8.buffer, pubKeyPtr, 32)

  Module._ed25519_derive_public_key(privKeyPtr, pubKeyPtr)

  var result = Buffer.from(pubKey)

  Module._free(pubKeyPtr)
  Module._free(privKeyPtr)

  return result
}

exports.sign = function (message, publicKey, privateKey) {
  if (!Buffer.isBuffer(message) || !Buffer.isBuffer(publicKey) || !Buffer.isBuffer(privateKey)) {
    throw new Error('Input arguments are not buffers!')
  }
  var msgLen = message.length
  var msgPtr = Module._malloc(msgLen)
  var msg = new Uint8Array(Module.HEAPU8.buffer, msgPtr, msgLen)
  msg.set(message)

  var pubKeyPtr = Module._malloc(32)
  var pubKey = new Uint8Array(Module.HEAPU8.buffer, pubKeyPtr, 32)
  pubKey.set(publicKey)

  var privKeyPtr = Module._malloc(32)
  var privKey = new Uint8Array(Module.HEAPU8.buffer, privKeyPtr, 32)
  privKey.set(privateKey)

  var sigPtr = Module._malloc(64)
  var sig = new Uint8Array(Module.HEAPU8.buffer, sigPtr, 64)

  /*
    WARNING: 0 is passed to the _ed25519_sign as 4th argument due to an error in the EMSCRIPTEN.
    In case of EMSCRIPTEN fix and correct build, testcase will fail and this 0 will be removed from here.
  */
  Module._ed25519_sign(sigPtr, msgPtr, msgLen, 0, pubKeyPtr, privKeyPtr)

  var result = Buffer.from(sig)

  Module._free(msgPtr)
  Module._free(pubKeyPtr)
  Module._free(privKeyPtr)
  Module._free(sigPtr)

  return result
}

exports.verify = function (signature, message, publicKey) {
  if (!Buffer.isBuffer(signature) || !Buffer.isBuffer(message) || !Buffer.isBuffer(publicKey)) {
    throw new Error('Input arguments are not buffers!')
  }

  var msgLen = message.length
  var msgPtr = Module._malloc(msgLen)
  var msg = new Uint8Array(Module.HEAPU8.buffer, msgPtr, msgLen)
  msg.set(message)

  var pubKeyPtr = Module._malloc(32)
  var pubKey = new Uint8Array(Module.HEAPU8.buffer, pubKeyPtr, 32)
  pubKey.set(publicKey)

  var sigPtr = Module._malloc(64)
  var sig = new Uint8Array(Module.HEAPU8.buffer, sigPtr, 64)
  sig.set(signature)

  /*
    WARNING: 0 is passed to the _ed25519_verify as 4th argument due to an error in the EMSCRIPTEN.
    In case of EMSCRIPTEN fix and correct build, testcase will fail and this 0 will be removed from here.
  */
  var result = Module._ed25519_verify(sigPtr, msgPtr, msgLen, 0, pubKeyPtr) === 1

  Module._free(msgPtr)
  Module._free(pubKeyPtr)
  Module._free(sigPtr)

  return result
}
