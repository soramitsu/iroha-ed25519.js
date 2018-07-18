const test = require('tape');
const ed25519 = require('..');

const privateKeys = [
  '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
  '4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb',
  'c5aa8df43f9f837bedb7442f31dcb7b166d38535076f094b85ce3a2e0b4458f7',
  '0d4a05b07352a5436e180356da0ae6efa0345ff7fb1572575772e8005ed978e9',
];

const publicKeys = [
  'a7d41f2ea60166d2c4fcbe145e97e4b8ef8f02471e92bb3158c7059dd7d0f990',
  '19438367352f678b4187ae69fe68dc861d1549ac0d269340b4d52387432b89dd',
  'a08fd46ee534e62d08e577a84a28601903d424bdf288be45644ece293672943e',
  'd1d0f980bd33b75ce7dbaafdb5a6a7439a1de09a58064eec0fb7376dcf3c5d23',
];

const messages = [
  '',
  '72',
  'af82',
  'cbc77b',
];

const signatures = [
  'a7c4b7a43befdf9d2b83e605cda59951abd379dbeec89ce2841429891134ea195b' +
  '09a0efbf1f51ea6f83d0f75607dbce87424949f0a83c6c1cc642bf15eaec02',
  '4867d6e8d468bf7e8b9a543d6e1a41450ee5d63cd5108139b95d3d201fa12af024d' +
  '5211b39d13987c4c4cbf059956ab6f823a473cca6707ab42afa71423b1201',
  '9efc1b853f839a2cdfb5371dd2a70f8c4515355caf1aedf7333c4fcd23cb443cd61' +
  '3dfec47cf4dcfd54951df22a685051f95e379f78f40a7e36a2c745eb3c705',
  'b1e9ef0d3b94326a8c96d36427e160809cb275ad6bd8e8b0746fe97e7fe4268b2c7' +
  '939701f1f8727c6c53704744e4db778f0d298c4aefabcd690a82d977ed10a',
];

test('Key pair generation', (t: any) => {
  t.plan(4);

  const keys = ed25519.createKeyPair();
  t.is(Buffer.isBuffer(keys.publicKey), true, 'Public key is a buffer');
  t.is(keys.publicKey.length, 32, 'Public key\'s length is 32');
  t.is(Buffer.isBuffer(keys.privateKey), true, 'Private key is a buffer');
  t.is(keys.privateKey.length, 32, 'Private key\'s length is 32');

  t.end();
});

test('Deriving public key', (t: any) => {
  t.plan(4);

  t.is(ed25519.derivePublicKey(Buffer.from(privateKeys[0], 'hex')).toString('hex'),
    publicKeys[0], 'Right public key for private key ' + privateKeys[0]);
  t.is(ed25519.derivePublicKey(Buffer.from(privateKeys[1], 'hex')).toString('hex'),
    publicKeys[1], 'Right public key for private key ' + privateKeys[1]);
  t.is(ed25519.derivePublicKey(Buffer.from(privateKeys[2], 'hex')).toString('hex'),
    publicKeys[2], 'Right public key for private key ' + privateKeys[2]);
  t.is(ed25519.derivePublicKey(Buffer.from(privateKeys[3], 'hex')).toString('hex'),
    publicKeys[3], 'Right public key for private key ' + privateKeys[3]);

  t.end();
});

test('Sign test', (t: any) => {
  t.plan(4);

  t.is(
    ed25519.sign(Buffer.from(messages[0], 'hex'), Buffer.from(publicKeys[0], 'hex'),
      Buffer.from(privateKeys[0], 'hex')).toString('hex'),
    signatures[0],
    'Right signature for message ' + messages[0] + ' with private key ' + privateKeys[0],
  );
  t.is(
    ed25519.sign(Buffer.from(messages[1], 'hex'), Buffer.from(publicKeys[1], 'hex'),
      Buffer.from(privateKeys[1], 'hex')).toString('hex'),
    signatures[1],
    'Right signature for message ' + messages[1] + ' with private key ' + privateKeys[1],
  );
  t.is(
    ed25519.sign(Buffer.from(messages[2], 'hex'), Buffer.from(publicKeys[2], 'hex'),
      Buffer.from(privateKeys[2], 'hex')).toString('hex'),
    signatures[2],
    'Right signature for message ' + messages[2] + ' with private key ' + privateKeys[2],
  );
  t.is(
    ed25519.sign(Buffer.from(messages[3], 'hex'), Buffer.from(publicKeys[3], 'hex'),
      Buffer.from(privateKeys[3], 'hex')).toString('hex'),
    signatures[3],
    'Right signature for message ' + messages[3] + ' with private key ' + privateKeys[3],
  );

  t.end();
});

test('Verification test', (t: any) => {
  t.plan(4);

  t.is(ed25519.verify(
    Buffer.from(signatures[0], 'hex'),
    Buffer.from(messages[0], 'hex'),
    Buffer.from(publicKeys[0], 'hex')),
    true,
    'Message ' + messages[0] + ' verification',
  );

  t.is(ed25519.verify(
    Buffer.from(signatures[1], 'hex'),
    Buffer.from(messages[1], 'hex'),
    Buffer.from(publicKeys[1], 'hex')),
    true,
    'Message ' + messages[1] + ' verification',
  );

  t.is(ed25519.verify(
    Buffer.from(signatures[2], 'hex'),
    Buffer.from(messages[2], 'hex'),
    Buffer.from(publicKeys[2], 'hex')),
    true,
    'Message ' + messages[2] + ' verification',
  );

  t.is(ed25519.verify(
    Buffer.from(signatures[3], 'hex'),
    Buffer.from(messages[3], 'hex'),
    Buffer.from(publicKeys[3], 'hex')),
    true,
    'Message ' + messages[3] + ' verification',
  );

  t.end();
});
