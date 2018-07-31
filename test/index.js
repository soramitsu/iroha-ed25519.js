var test = require('tape')
var ed25519 = require('..')

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

var privateKeys = [
  '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
  '4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb',
  'c5aa8df43f9f837bedb7442f31dcb7b166d38535076f094b85ce3a2e0b4458f7',
  '0d4a05b07352a5436e180356da0ae6efa0345ff7fb1572575772e8005ed978e9'
]

var publicKeys = [
  'a7d41f2ea60166d2c4fcbe145e97e4b8ef8f02471e92bb3158c7059dd7d0f990',
  '19438367352f678b4187ae69fe68dc861d1549ac0d269340b4d52387432b89dd',
  'a08fd46ee534e62d08e577a84a28601903d424bdf288be45644ece293672943e',
  'd1d0f980bd33b75ce7dbaafdb5a6a7439a1de09a58064eec0fb7376dcf3c5d23'
]

var messages = [
  '',
  '72',
  'af82',
  'cbc77b'
]

var signatures = [
  'a7c4b7a43befdf9d2b83e605cda59951abd379dbeec89ce2841429891134ea195b09a0efbf1f51ea6f83d0f75607dbce87424949f0a83c6c1cc642bf15eaec02',
  '4867d6e8d468bf7e8b9a543d6e1a41450ee5d63cd5108139b95d3d201fa12af024d5211b39d13987c4c4cbf059956ab6f823a473cca6707ab42afa71423b1201',
  '9efc1b853f839a2cdfb5371dd2a70f8c4515355caf1aedf7333c4fcd23cb443cd613dfec47cf4dcfd54951df22a685051f95e379f78f40a7e36a2c745eb3c705',
  'b1e9ef0d3b94326a8c96d36427e160809cb275ad6bd8e8b0746fe97e7fe4268b2c7939701f1f8727c6c53704744e4db778f0d298c4aefabcd690a82d977ed10a'
]

test('Key pair generation', function (t) {
  t.plan(4)

  var keys = ed25519.createKeyPair()
  t.is(keys.publicKey.length, 32, 'Public key\'s length is 32')
  t.is(keys.privateKey.length, 32, 'Private key\'s length is 32')
  t.is(Object.prototype.toString.call(keys.publicKey), '[object Uint8Array]', 'Public key is Uint8Array')
  t.is(Object.prototype.toString.call(keys.privateKey), '[object Uint8Array]', 'Private key is Uint8Array')

  t.end()
})

test('Deriving public key', function (t) {
  t.plan(4)

  t.is(ed25519.derivePublicKey(hexStringToByte(privateKeys[0])).toString(), hexStringToByte(publicKeys[0]).toString(), 'Right public key for private key ' + privateKeys[0])
  t.is(ed25519.derivePublicKey(hexStringToByte(privateKeys[1])).toString(), hexStringToByte(publicKeys[1]).toString(), 'Right public key for private key ' + privateKeys[1])
  t.is(ed25519.derivePublicKey(hexStringToByte(privateKeys[2])).toString(), hexStringToByte(publicKeys[2]).toString(), 'Right public key for private key ' + privateKeys[2])
  t.is(ed25519.derivePublicKey(hexStringToByte(privateKeys[3])).toString(), hexStringToByte(publicKeys[3]).toString(), 'Right public key for private key ' + privateKeys[3])

  t.end()
})

test('Sign test', function (t) {
  t.plan(4)

  t.is(ed25519.sign(hexStringToByte(messages[0]), hexStringToByte(publicKeys[0]), hexStringToByte(privateKeys[0])).toString(), hexStringToByte(signatures[0]).toString(), 'Right signature for message ' + messages[0] + ' with private key ' + privateKeys[0])
  t.is(ed25519.sign(hexStringToByte(messages[1]), hexStringToByte(publicKeys[1]), hexStringToByte(privateKeys[1])).toString(), hexStringToByte(signatures[1]).toString(), 'Right signature for message ' + messages[1] + ' with private key ' + privateKeys[1])
  t.is(ed25519.sign(hexStringToByte(messages[2]), hexStringToByte(publicKeys[2]), hexStringToByte(privateKeys[2])).toString(), hexStringToByte(signatures[2]).toString(), 'Right signature for message ' + messages[2] + ' with private key ' + privateKeys[2])
  t.is(ed25519.sign(hexStringToByte(messages[3]), hexStringToByte(publicKeys[3]), hexStringToByte(privateKeys[3])).toString(), hexStringToByte(signatures[3]).toString(), 'Right signature for message ' + messages[3] + ' with private key ' + privateKeys[3])

  t.end()
})

test('Verification test', function (t) {
  t.plan(4)

  t.is(ed25519.verify(hexStringToByte(signatures[0]), hexStringToByte(messages[0]), hexStringToByte(publicKeys[0])), true, 'Message ' + messages[0] + ' verification')
  t.is(ed25519.verify(hexStringToByte(signatures[1]), hexStringToByte(messages[1]), hexStringToByte(publicKeys[1])), true, 'Message ' + messages[1] + ' verification')
  t.is(ed25519.verify(hexStringToByte(signatures[2]), hexStringToByte(messages[2]), hexStringToByte(publicKeys[2])), true, 'Message ' + messages[2] + ' verification')
  t.is(ed25519.verify(hexStringToByte(signatures[3]), hexStringToByte(messages[3]), hexStringToByte(publicKeys[3])), true, 'Message ' + messages[3] + ' verification')

  t.end()
})
