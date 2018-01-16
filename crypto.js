var Module = require('./ed25519')

exports.createKeyPair = function(){
  var pubKeyPtr = Module._malloc(32)
  var pubKey = new Uint8Array(Module.HEAPU8.buffer, pubKeyPtr, 32)

  var privKeyPtr = Module._malloc(32)
  var privKey = new Uint8Array(Module.HEAPU8.buffer, privKeyPtr, 32)
  
  Module._ed25519_create_keypair(privKeyPtr, pubKeyPtr)

  res = {
    publicKey: new Buffer(pubKey),
    privateKey: new Buffer(privKey)
  }

  Module._free(pubKeyPtr)
  Module._free(privKeyPtr)

  return res;
}

exports.derivePublicKey = function(privateKey){
  var privateKey = new Buffer(privateKey)
  var privKeyPtr = Module._malloc(32)
  var privKey = new Uint8Array(Module.HEAPU8.buffer, privKeyPtr, 32)
  privKey.set(privateKey)

  var pubKeyPtr = Module._malloc(32)
  var pubKey = new Uint8Array(Module.HEAPU8.buffer, pubKeyPtr, 32)

  Module._ed25519_derive_public_key(privKeyPtr, pubKeyPtr)

  res = new Buffer(pubKey)

  Module._free(pubKeyPtr)
  Module._free(privKeyPtr)

  return res
}

exports.sign = function(message, publicKey, privateKey){
  var message = new Buffer(message)
  var msgLen = message.length
  var msgPtr = Module._malloc(msgLen)
  var msg = new Uint8Array(Module.HEAPU8.buffer, msgPtr, msgLen)
  msg.set(message)

  var publicKey = new Buffer(publicKey, 'base64')
  var pubKeyPtr = Module._malloc(32)
  var pubKey = new Uint8Array(Module.HEAPU8.buffer, pubKeyPtr, 32)
  pubKey.set(publicKey)

  var privateKey = new Buffer(privateKey, 'base64')
  var privKeyPtr = Module._malloc(32)
  var privKey = new Uint8Array(Module.HEAPU8.buffer, privKeyPtr, 32)
  privKey.set(privateKey)

  var sigPtr = Module._malloc(64)
  var sig = new Uint8Array(Module.HEAPU8.buffer, sigPtr, 64)

  Module._ed25519_sign(sigPtr, msgPtr, msgLen, pubKeyPtr, privKeyPtr)

  res = new Buffer(sig)

  Module._free(msgPtr)
  Module._free(pubKeyPtr)
  Module._free(privKeyPtr)
  Module._free(sigPtr)

  return res
}

exports.verify = function(signature, message, publicKey){
  var message = new Buffer(message)
  var msgLen = message.length
  var msgPtr = Module._malloc(msgLen)
  var msg = new Uint8Array(Module.HEAPU8.buffer, msgPtr, msgLen)
  msg.set(message)

  var publicKey = new Buffer(publicKey, 'base64')
  var pubKeyPtr = Module._malloc(32)
  var pubKey = new Uint8Array(Module.HEAPU8.buffer, pubKeyPtr, 32)
  pubKey.set(publicKey)

  var signature = new Buffer(signature, 'base64')
  var sigPtr = Module._malloc(64)
  var sig = new Uint8Array(Module.HEAPU8.buffer, sigPtr, 64)
  sig.set(signature)

  res = Module._ed25519_verify(sigPtr, msgPtr, msgLen, pubKeyPtr) === 1

  Module._free(msgPtr)
  Module._free(pubKeyPtr)
  Module._free(sigPtr)

  return res
}