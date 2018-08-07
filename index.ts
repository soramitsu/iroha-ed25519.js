/**
 * Copyright Soramitsu Co., Ltd. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { Buffer } from 'buffer';
import * as Module from './lib/ed25519.min.js';

export const createKeyPair = (): { publicKey: Buffer, privateKey: Buffer } => {
  const pubKeyPtr = Module._malloc(32);
  const pubKey = new Uint8Array(Module.HEAPU8.buffer, pubKeyPtr, 32);

  const privKeyPtr = Module._malloc(32);
  const privKey = new Uint8Array(Module.HEAPU8.buffer, privKeyPtr, 32);

  Module._ed25519_create_keypair(privKeyPtr, pubKeyPtr);

  const result = {
    privateKey: Buffer.from(privKey as any),
    publicKey: Buffer.from(pubKey as any),
  };

  Module._free(pubKeyPtr);
  Module._free(privKeyPtr);

  return result;
};

export const derivePublicKey = (privateKey: Buffer): Buffer => {
  if (!Buffer.isBuffer(privateKey)) {
    throw new Error('Input arguments are not buffers!');
  }

  const privKeyPtr = Module._malloc(32);
  const privKey = new Uint8Array(Module.HEAPU8.buffer, privKeyPtr, 32);
  privKey.set(privateKey);

  const pubKeyPtr = Module._malloc(32);
  const pubKey = new Uint8Array(Module.HEAPU8.buffer, pubKeyPtr, 32);

  Module._ed25519_derive_public_key(privKeyPtr, pubKeyPtr);

  const result = Buffer.from(pubKey as any);

  Module._free(pubKeyPtr);
  Module._free(privKeyPtr);

  return result;
};

export const sign = (message: Buffer, publicKey: Buffer, privateKey: Buffer): Buffer => {
  if (!Buffer.isBuffer(message) || !Buffer.isBuffer(publicKey) || !Buffer.isBuffer(privateKey)) {
    throw new Error('Input arguments are not buffers!');
  }
  const msgLen = message.length;
  const msgPtr = Module._malloc(msgLen);
  const msg = new Uint8Array(Module.HEAPU8.buffer, msgPtr, msgLen);
  msg.set(message);

  const pubKeyPtr = Module._malloc(32);
  const pubKey = new Uint8Array(Module.HEAPU8.buffer, pubKeyPtr, 32);
  pubKey.set(publicKey);

  const privKeyPtr = Module._malloc(32);
  const privKey = new Uint8Array(Module.HEAPU8.buffer, privKeyPtr, 32);
  privKey.set(privateKey);

  const sigPtr = Module._malloc(64);
  const sig = new Uint8Array(Module.HEAPU8.buffer, sigPtr, 64);

  /*
    WARNING: 0 is passed to the _ed25519_sign as 4th argument due to an error in the EMSCRIPTEN.
    In case of EMSCRIPTEN fix and correct build, testcase will fail and this 0 will be removed from here.
  */
  Module._ed25519_sign(sigPtr, msgPtr, msgLen, 0, pubKeyPtr, privKeyPtr);

  const result = Buffer.from(sig as any);

  Module._free(msgPtr);
  Module._free(pubKeyPtr);
  Module._free(privKeyPtr);
  Module._free(sigPtr);

  return result;
};

export const verify = (signature: Buffer, message: Buffer, publicKey: Buffer): boolean => {
  if (!Buffer.isBuffer(signature) || !Buffer.isBuffer(message) || !Buffer.isBuffer(publicKey)) {
    throw new Error('Input arguments are not buffers!');
  }

  const msgLen = message.length;
  const msgPtr = Module._malloc(msgLen);
  const msg = new Uint8Array(Module.HEAPU8.buffer, msgPtr, msgLen);
  msg.set(message);

  const pubKeyPtr = Module._malloc(32);
  const pubKey = new Uint8Array(Module.HEAPU8.buffer, pubKeyPtr, 32);
  pubKey.set(publicKey);

  const sigPtr = Module._malloc(64);
  const sig = new Uint8Array(Module.HEAPU8.buffer, sigPtr, 64);
  sig.set(signature);

  /*
    WARNING: 0 is passed to the _ed25519_verify as 4th argument due to an error in the EMSCRIPTEN.
    In case of EMSCRIPTEN fix and correct build, testcase will fail and this 0 will be removed from here.
  */
  const result = Module._ed25519_verify(sigPtr, msgPtr, msgLen, 0, pubKeyPtr) === 1;

  Module._free(msgPtr);
  Module._free(pubKeyPtr);
  Module._free(sigPtr);

  return result;
};
