# ed25519.js [![npm version](https://badge.fury.io/js/ed25519.js.svg)](https://badge.fury.io/js/ed25519.js) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com) [![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)



[https://github.com/hyperledger/iroha-ed25519](https://github.com/warchant/ed25519.git) compiled with [Emscripten](https://github.com/kripken/emscripten) and wrapper for it.

## Installation
Yarn: `yarn add ed25519.js`

NPM: `npm install ed25519.js`

After it, you can use it with `require('ed25519.js')`

## Example
This library produces Typed Arrays (Uint8Array) and requires them as input.

Helper function to get Uint8Array from hex string (not in package yet)
```
function hexStringToByte (str) {
  if (!str) {
    return new Uint8Array()
  }

  var a = []
  for (var i = 0, len = str.length; i < len; i += 2) {
    a.push(parseInt(str.substr(i, 2), 16))
  }

  return new Uint8Array(a)
}
```

Generating keypair
```
var ed25519 = require('ed25519.js')

var keys = ed25519.createKeyPair() //Generate keypair
console.log(keys.publicKey) // Generated public key, stored as Uint8Array
console.log(keys.privateKey) // Generated private key, stored as Uint8Array
```

Deriving public key, signing and verifying message
```
var ed25519 = require('ed25519.js')

// Example private key, parsed from hex string as Uint8Array
var privateKey = hexStringToByte('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60')

// Derived public key, stored as Uint8Array
var publicKey = ed25519.derivePublicKey(privateKey)

// Message, stored as Uint8Array
var message = hexStringToByte('Cool message')

// Signing Uint8Array
var signature = ed25519.sign(message, publicKey, privateKey)

// Verifying Uint8Array
var isVerified = ed25519.verify(signature, message, publicKey)

console.log(isVerified)
```

## TODOs
- [x] Write tests
- [x] Use Standard.js
- [x] Add PreCommit/Push hooks
- [x] Write an example to readme
- [x] License
- [x] Create NPM package
- [ ] Uglify/Minify
- [ ] JSDoc
- [ ] Compile library from C++ on the fly
- [ ] More tests

## License
[Apache License 2.0](LICENSE.md)
