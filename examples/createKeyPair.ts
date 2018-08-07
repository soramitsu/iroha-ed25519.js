/**
 * Copyright Soramitsu Co., Ltd. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createKeyPair } from '../index';

let keys = createKeyPair();

console.log(`Private key: ${keys.privateKey.toString('hex')}`);
console.log(`Public key: ${keys.publicKey.toString('hex')}`);
