'use strict'

const bip39 = require('bip39')
const bitcoin = require('bitcoinjs-lib')
const bip32utils = require('bip32-utils')
const secrets = require('secrets.js-grempe')
const fs = require('fs')


function generateWalletseed() {
  var mnemonic = bip39.generateMnemonic(256)
  var hexSeed = bip39.mnemonicToSeedHex(mnemonic)
  var isValidMnemonic = bip39.validateMnemonic(mnemonic)
  return hexSeed
}

const initialEntropy = 256
const m = 2
const n = 3 
const outputFileNamePrefix = 'out'

function setupWalletWithShamir() {
  var mnemonic = bip39.generateMnemonic(initialEntropy)
  //console.log(mnemonic)
  var mnemonicHex = secrets.str2hex(mnemonic);
  var shares = secrets.share(mnemonicHex, n, m)
  for(var i=0; i<n; i++) { 
    fs.writeFileSync(outputFileNamePrefix+i, shares[i], 'binary')
  }
  console.log("successfully written secrets to split files.")
}

const recoveryFiles = ['out0', 'out2']

function recoverWalletWithShamir() {
  var recoveryMnemonicsHexArr = []
  for(var i=0; i<recoveryFiles.length; i++) {
    var mHex = fs.readFileSync(recoveryFiles[i]).toString('binary')
    recoveryMnemonicsHexArr.push(mHex)
  }
  //TODO: if rocveryMnemonicsHex.length is != recoveryFiles.length then error and exit
  var recoveredMnemonicsHex = secrets.combine(recoveryMnemonicsHexArr)
  var recoveredMnemonics = secrets.hex2str(recoveredMnemonicsHex)
  console.log("successfully recovered.")
  return recoveredMnemonics
}


//setupWalletWithShamir()
//recoverWalletWithShamir()


function testWallet1() {
  var seedHex = '000102030405060708090a0b0c0d0e0f'
  var mkNode = bitcoin.HDNode.fromSeedHex(seedHex)
  console.log(mkNode.getAddress())
  console.log(mkNode.getPublicKeyBuffer())
  console.log(mkNode.toBase58())
  console.log(mkNode.neutered().toBase58())

  var m0hNode = mkNode.deriveHardened(0)
  console.log(m0hNode.toBase58())
  console.log(m0hNode.neutered().toBase58())

  var m0H12H = mkNode.deriveHardened(0)
                      .derive(1)
                      .deriveHardened(2)
  console.log(m0H12H.toBase58())
  console.log(m0H12H.neutered().toBase58())

  var chain = new bip32utils.Chain(m0hNode.neutered())
  for (var k = 0; k < 110; ++k) 
    chain.next()
  var pubAdd = chain.get()
  console.log(pubAdd)
  var pubAdd99 = '18xmptXkeiWGLhr9JVjBpDTyR7Mxy4qgh3'
  var addInChain = chain.find(pubAdd99)
  console.log('address in chain should be 99, actual:' + addInChain)
  console.log(chain.find('14icLpvdz5HRBEsQBFMLUuXxwZKvvi78TY'))

}

testWallet1()
