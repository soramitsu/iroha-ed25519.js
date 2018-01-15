
var crypto = require('./crypto')

var hexStringToBuffer = function(string){
  var array = string.match(/.{1,2}/g)
  array = array.map(x => parseInt(x, 16))
  return new Buffer(array)
}

// public = '292a8714694095edce6be799398ed5d6244cd7be37eb813106b217d850d261f2'
// private = '8316fe25fda2bb3964ae756251b5f1fe010fafe56443978d524dc6485548be76'

private = '7c877637e9010f88309d82a735ee328750b57663ae9050fc1493cc6380d5c354'
public = '02e4e5aa82bb137e34271f84323d58d1eaa0bde729551e227a5decddcc92f310'

publicB = hexStringToBuffer(public)
privateB = hexStringToBuffer(private)

publicKappa = crypto.derivePublicKey(privateB)

console.log(publicKappa)
console.log(publicB)

var message = "raw data for signing"
var signature = crypto.sign(message, publicB, privateB)
console.log(signature)
console.log(crypto.verify(signature, message, publicB))

keys = crypto.createKeyPair();
console.log(keys.privateKey)
console.log(keys.publicKey)
console.log(crypto.derivePublicKey(keys.privateKey))