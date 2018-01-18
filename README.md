# ed25519.js [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

A javascript port of [warchant/ed25519](https://github.com/warchant/ed25519.git) and wrapper for it.

## Example
This library produces buffers of bytes and requires buffers as input

Generating keypair
```
var keys = ed25519.createKeyPair() //Generate keypair
console.log(keys.publicKey) // Generated public key, stored as buffer
console.log(keys.privateKey) // Generated private key, stored as buffer
```

Deriving public key, signing and verifying message
```
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
