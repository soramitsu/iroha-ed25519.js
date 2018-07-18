import { createKeyPair } from './../index';

let keys = createKeyPair();

console.log(`Private key: ${keys.privateKey.toString('hex')}`);
console.log(`Public key: ${keys.publicKey.toString('hex')}`);
