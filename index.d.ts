/// <reference types="node" />
export declare const createKeyPair: () => {
    publicKey: Buffer;
    privateKey: Buffer;
};
export declare const derivePublicKey: (privateKey: Buffer) => Buffer;
export declare const sign: (message: Buffer, publicKey: Buffer, privateKey: Buffer) => Buffer;
export declare const verify: (signature: Buffer, message: Buffer, publicKey: Buffer) => boolean;
