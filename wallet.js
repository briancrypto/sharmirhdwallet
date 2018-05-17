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
  var mkNode = bitcoin.HDNode.fromSeedHex(seedHex, bitcoin.networks.testnet)
  console.log(mkNode.getAddress())
  console.log(mkNode.getPublicKeyBuffer())
  console.log(mkNode.toBase58())
  console.log(mkNode.neutered().toBase58())

  var m0hNode = mkNode.deriveHardened(0)
  console.log("m/0h:" + m0hNode.toBase58())
  console.log("M/0h:" + m0hNode.neutered().toBase58())
  // m/0h:tprv8bxNLu25VazNnppTCP4fyhyCvBHcYtzE3wr3cwYeL4HA7yf6TLGEUdS4QC1vLT63TkjRssqJe4CvGNEC8DzW5AoPUw56D1Ayg6HY4oy8QZ9
  // M/0h:tpubD8eQVK4Kdxg3gHrF62jGP7dKVCoYiEB8dFSpuTawkL5YxTus5j5pf83vaKnii4bc6v2NVEy81P2gYrJczYne3QNNwMTS53p5uzDyHvnw2jm


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
  var pubAdd99 = 'mxvEGj6pvxa9jciAtUgkud7oCkcRaZbDyk'
  var addInChain = chain.find(pubAdd99)
  console.log('address in chain should be 110, actual:' + addInChain)
  console.log(chain.find('14icLpvdz5HRBEsQBFMLUuXxwZKvvi78TY'))

}

function importAndGenerateNewAddress() {
  var xPub = 'tpubD8eQVK4Kdxg3gHrF62jGP7dKVCoYiEB8dFSpuTawkL5YxTus5j5pf83vaKnii4bc6v2NVEy81P2gYrJczYne3QNNwMTS53p5uzDyHvnw2jm'
  var m0hChain = new bip32utils.Chain(bitcoin.HDNode.fromBase58(xPub, bitcoin.networks.testnet))
  for (var i=0; i<10; i++) {
    m0hChain.next()
    console.log(m0hChain.get())
  }
  /* public mainnet
    1JQheacLPdM5ySCkrZkV66G2ApAXe1mqLj
    1MF1zYw5uEQiESDYq88vdEde6bLjah6tiu
    1BWVwxpt9vbU1AZPEJmhDF2n5LK8asFGg8
    1C4SsQwJ9rt2sEhaS5sz4QHWCiyF5YewKE
    1HZa7XvUXhaybGosx7mB1qEwidApRHxoRV
    13CsMSvPzH4gYQtfd2qbBmbhxdaNxDW95C
    1CXYxpgiiGy9yZraeEHA5PQgU9Ds8iAHE1
    1BUByp5PeTmbxSyZU2DCVNMeSoNk9Gb7h2
    13ijQ7rFtQP6ASPk1eAiYqusiCsYHpjy3a
    1CeQUeAG4E1wUuYjVcvgXJw8qct6ezE2gj

    public testnet
    mxvewdhKCenLkYgNa8irv1UM2omEWPMdEE
    n1kyHc24iFqy1YhAYh7JT9qxxawSY1dt8z
    mr2TF1urxx2inH2zwsk53AF6wKuqZ9n7Ek
    mraQAU2GxtKHeMBC9erMtKVq4iZx1H61ei
    mx5XQb1TLj2ENPHVfgjYqkTGacmXNTy5Xc
    mhipeW1NoJVwKXNHLboy1gp2pdB5snN9Kf
    ms3WFsmhXJQQkgLCMoFXuJd1L8pa96NiPp
    mqz9GsANTVCrjZTBBbBaKHZyJnyT7j7Mo3
    miEghAwEhRpLwYsMjD96Nm8CaCUFCZbvZp
    msAMmhFEsFTCG22MDBu4ME9ThcUoZgruq1
  */
}

function signRawTransactionFor() {
  var tx = new bitcoin.TransactionBuilder()
  tx.addInput("3942ea61e76f910b396c888b217a935bcf60f3d4e2dedd4cb52c134f5d14b068", 0)
  tx.addOutput("n1kyHc24iFqy1YhAYh7JT9qxxawSY1dt8z", 20000)
  tx.sign(0, derivePrivateKey("mxvewdhKCenLkYgNa8irv1UM2omEWPMdEE"))
}

function derivePrivateKey() {
  //https://github.com/bitcoinjs/bitcoinjs-lib/issues/997
  var seedHex = '000102030405060708090a0b0c0d0e0f'
  var mkNode = bitcoin.HDNode.fromSeedHex(seedHex, bitcoin.networks.testnet)
  var m0hNode = mkNode.deriveHardened(0)
  var privateKeys = []
  for(var i=0; i<10; i++) {
    var pk = m0hNode.derive(i).keyPair
    var pkXpub = m0hNode.neutered().derive(i).keyPair
    console.log("public key (from pkpair):" + pk.getAddress())
    console.log("public key (from xpub)  :" + pkXpub.getAddress())
    console.log("private key:" + pk.toWIF())
    //console.log("private key:" + pkXpub.toWIF())
  }


}
  

//testWallet1()
derivePrivateKey()
//importAndGenerateNewAddress()
