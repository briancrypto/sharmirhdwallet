'use strict'

const bip39 = require('bip39')
const bitcoin = require('bitcoinjs-lib')
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


setupWalletWithShamir()
recoverWalletWithShamir()

