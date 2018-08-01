# ed25519.js [![npm version](https://badge.fury.io/js/ed25519.js.svg)](https://badge.fury.io/js/ed25519.js) [![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)



[https://github.com/hyperledger/iroha-ed25519](https://github.com/warchant/ed25519.git) compiled with [Emscripten](https://github.com/kripken/emscripten) and wrapper for it.

## Installation
Yarn: `yarn add ed25519.js`

NPM: `npm install ed25519.js`

After it, you can use it with `require('ed25519.js')`

## Example
This library produces buffers of bytes and requires buffers as input

Generating keypair
```
var ed25519 = require('ed25519.js')

var keys = ed25519.createKeyPair() //Generate keypair
console.log(keys.publicKey) // Generated public key, stored as buffer
console.log(keys.privateKey) // Generated private key, stored as buffer
```

Deriving public key, signing and verifying message
```
var ed25519 = require('ed25519.js')

// Example private key, parsed from hex string as buffer
var privateKey = Buffer.from('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60', 'hex')

// Derived public key, stored as buffer
var publicKey = ed25519.derivePublicKey(privateKey)

// Message, stored as buffer
var message = Buffer.from('Cool message', 'utf8')

// Signing message
var signature = ed25519.sign(message, publicKey, privateKey)

// Verifying message
var isVerified = ed25519.verify(signature, message, publicKey)

console.log(isVerified)
```

### TS Examples

You can test typescript examples by running this command
```
node -r ts-node/register ./examples/createKeyPair.ts
```


## TODOs
- [x] Write tests
- [x] Use Standard.js
- [x] Add PreCommit/Push hooks
- [x] Write an example to readme
- [x] License
- [x] Create NPM package
- [x] Migrate code to TS
- [x] Code examples in TS 
- [ ] Uglify/Minify
- [x] TSDoc
- [ ] Compile library from C++ on the fly
- [ ] More tests

## License
[Apache License 2.0](LICENSE.md)
