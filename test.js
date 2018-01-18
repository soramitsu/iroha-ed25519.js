var crypto = require('./crypto')

var hexStringToBuffer = function(string){
  var array = string.match(/.{1,2}/g)
  array = array.map(x => parseInt(x, 16))
  return new Buffer(array)
}

var hexStringToString = function(string){
  var array = string.match(/.{1,2}/g)
  array = array.map(x => String.fromCharCode(parseInt(x, 16)))
  return array.join('')
}

var arrToHexString = function(array){
  return array.map(x => ('00' + x.toString(16)).substr(-2)).join('')
}

// public = '292a8714694095edce6be799398ed5d6244cd7be37eb813106b217d850d261f2'
// private = '8316fe25fda2bb3964ae756251b5f1fe010fafe56443978d524dc6485548be76'
publicAr = [107, 181, 158, 245, 247, 183, 27, 91, 108, 52, 111, 223, 36, 227, 41, 99, 49, 13, 215, 251, 50, 255, 151, 25, 166, 244, 241, 42, 135, 240, 243, 169]
privateAr = [145, 128, 240, 241, 234, 133, 90, 254, 45, 26, 237, 201, 35, 23, 79, 207, 252, 77, 136, 113, 209, 161, 171, 64, 96, 79, 241, 77, 119, 81, 189, 168]

// private = '7c877637e9010f88309d82a735ee328750b57663ae9050fc1493cc6380d5c354'
// public = '02e4e5aa82bb137e34271f84323d58d1eaa0bde729551e227a5decddcc92f310'

// public  = 'de6defad8630bdf1c5e6e307ed55e15c23930649434ce66b51057f5b199432ad'
// private = '08bf414f2103efb2ea08e5db4b0d80e06108f8214f3fe9d760063be907225f8a'


private = arrToHexString(privateAr)
k = hexStringToBuffer(private)
console.log(k)

message1 = '726177206461746120666f72207369676e696e67'
message2 = 'raw data for signing'
message = 'abcdefgh'
s = 'e4fb474d44e7893e3d2966488afad5c106a743be55a9b2d1e3ebc6a1013277618023193f77c4f14bc9bd7d566132590387e31308fd36bed276a27a81e1c35003'

privateB = hexStringToBuffer(private)
publicB = crypto.derivePublicKey(privateB)
console.log(publicB)
//publicB = hexStringToBuffer(public)
//messageB = hexStringToBuffer(message)
signB = hexStringToBuffer(s)

var signature = crypto.sign(message, publicB, privateB)
console.log('Signature: ')
console.log(signature)
console.log(crypto.verify(signature, message, publicB))

// keys = crypto.createKeyPair();
// // console.log(keys.privateKey)
// // console.log(keys.publicKey)
// // console.log(crypto.derivePublicKey(keys.privateKey))
// sign = crypto.sign(message, keys.privateKey)