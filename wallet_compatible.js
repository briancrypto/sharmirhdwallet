'use strict'

const bip39 = require('bip39')
const bitcoin = require('bitcoinjs-lib')
const bip32utils = require('bip32-utils')
const secrets = require('secrets.js-grempe')
const fs = require('fs')
const request = require('request')
const reverse = require("buffer-reverse")


const BIP44_BITCOIN_HIER_MAIN = "m/44'/0'/0'"
const BIP44_BITCOIN_HIER_TEST = "m/44'/1'/0'"

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
  var seedHex = bip39.mnemonicToSeedHex(mnemonic)
  console.log(seedHex)
  var shares = secrets.share(seedHex, n, m)
  for(var i=0; i<n; i++) { 
    fs.writeFileSync(outputFileNamePrefix+i, shares[i], 'binary')
  }
  console.log("successfully written secrets to split files.")
}

const recoveryFiles = ['out0', 'out2']

function recoverWalletWithShamir() {
  var recoveryHexArr = []
  for(var i=0; i<recoveryFiles.length; i++) {
    var mHex = fs.readFileSync(recoveryFiles[i]).toString('binary')
    recoveryHexArr.push(mHex)
  }
  //TODO: if rocveryMnemonicsHex.length is != recoveryFiles.length then error and exit
  var recoveredHex = secrets.combine(recoveryHexArr)
  console.log(recoveredHex)
  console.log("successfully recovered.")
  return recoveredHex
}

//setupWalletWithShamir()
//recoverWalletWithShamir()

function BitcoinWallet(networkStr) {
  this.networkStr = networkStr
  if(networkStr === "test") {
    this.network = bitcoin.networks.testnet
    this.basepath = BIP44_BITCOIN_HIER_TEST
  } else {
    this.network = bitcoin.networks.bitcoin
    this.basepath = BIP44_BITCOIN_HIER_MAIN
  }
}

BitcoinWallet.prototype.init = function () {
  //xpubString = xpubString || 'tpubDDNzegCfDJfvydexS9ZMxMLmKcrRfPKydwMm9Nm6kpX6jNXTqMcSascvjZDqL8q3qu5joJqaJsmvvbGbkwJL5A4212ZPZkyAjoS8WZS8qJq'
  // xpubString = 'xpub6CBhr9A6hYbCH4S35uAoDVYcs31' +
  //               'vMTwh9kaQ177ftZ6tVhWbFAov1C1ekKwu6KJ4Ydvdmp9cuDArAN9TUFpVjfJwZ9nqKMWcrmbzCcTSqU8'

  var seedHex = '48803c53ba341acc80b1550e1a919273f8aaa7cf959c38c9781db5ac00439802f365fc4834b5c4e3cc117fe5e20fb0b8a8aa671aa4871dfd443b169ca16f0711'
  var masterNode = bitcoin.HDNode.fromSeedHex(seedHex, this.network)
  var acc0Node = masterNode.derivePath(this.basepath)
  this.xpubString = acc0Node.neutered().toBase58()
  console.log(this.xpubString)
  var add0FromXpubNode = bitcoin.HDNode.fromBase58(this.xpubString, this.network)
  this.chain0 = new bip32utils.Chain(add0FromXpubNode.derive(0))
  this.acc0ChildNode = acc0Node.derive(0)
}

BitcoinWallet.prototype.getNextPubAddress = function(batchPubAddToGenerate) {
  batchPubAddToGenerate = batchPubAddToGenerate || 10
  var pubAdds = []
  for (var k = 0; k < batchPubAddToGenerate; ++k) {
    var pubAdd = this.chain0.get()
    pubAdds.push(pubAdd)
    console.log("pub address:" + pubAdd)
    this.chain0.next()
  }
  /*
  pub address:mtH4qkmHKUn2EdNxCpdcheyYeFhDpVYQkt
  pub address:mgJSLeR4Z7gfS7xJP3To66biwjnSvajaeK
  pub address:mfc81sQxy4ekUoaEVZahbDe3U5oUzAfNsV
  pub address:ms1U4MfbWyDhr48eHqyjpsH6ACGopcotye
  pub address:n3zi3e8428WjMQCvtBZSnrh2pW5MDWkqc5
  pub address:mnD8GRmayJWtCZU9YyZBvJ2SfM9VsT8uxC
  pub address:mvbHqwCGVK18qPeLGAHbmBM4S5acDCwKn3
  pub address:mgUynmf5KHtTjivizY4Qo9nnkQ9AWhexsh
  pub address:mrAoZH55uksrGzBp2DtgWKhxaze478sP6z
  pub address:mik4Psy8VKyA47v8SHGV2K3Q371kR9f64z
  */
  return pubAdds
}

BitcoinWallet.prototype.getPrivateKeys = function(publicKeys) {
  var pubPriMap = {}
  publicKeys = publicKeys || ['mtH4qkmHKUn2EdNxCpdcheyYeFhDpVYQkt', 'mik4Psy8VKyA47v8SHGV2K3Q371kR9f64z']


  publicKeys.forEach(pub => {
    var childIdx = this.chain0.find(pub)
    console.log('retrieving index of public key of %s: %i', pub, childIdx)
    var childIdxPrivAcc = this.acc0ChildNode.derive(childIdx).keyPair
    console.log('public key:' + childIdxPrivAcc.getAddress())
    console.log('private key:' + childIdxPrivAcc.toWIF())
    console.log('public key buffer:', childIdxPrivAcc.getPublicKeyBuffer())
    //pubPriMap[pub] = childIdxPrivAcc.toWIF()
    pubPriMap[pub] = childIdxPrivAcc
  })
  return pubPriMap
}

/*
"inputs": [{"tx": "tx_hash", "tx_input_id": 1}, {"tx": "tx_hash", "tx_input_id": 1}]
"outputs": [{"out_address": "outgoing address", "amount": 1234}, {"out_address": "outgoing address", "amount": 1234}]
*/
BitcoinWallet.prototype.createRawTransaction = function(inputs, outputs) {
  var txBuilder = new bitcoin.TransactionBuilder(this.network)
  inputs.forEach(input => {
    txBuilder.addInput(input["tx"], input["tx_input_id"])
    console.log("tx:%s, txid:%i" , input["tx"], input["tx_input_id"])
  })
  outputs.forEach(output => {
    txBuilder.addOutput(output["out_address"], output["amount"])
    console.log("out_address:%s, amount:%i" , output["out_address"], output["amount"])
  })
  this.tempSignTransaction(txBuilder)

  // var rawIncompleteTx = txBuilder.buildIncomplete().toHex()
  // console.log(rawIncompleteTx);

  // return rawIncompleteTx
}

BitcoinWallet.prototype.tempSignTransaction = function(txBuilder) {
  txBuilder.tx.ins.forEach(input => {
    console.log("hash:%o, index:%i", reverse(input.hash).toString('hex'), input.index)
    BitcoinWallet.getTransaction(reverse(input.hash).toString('hex'))
      .then(transaction => {
        var outputs = transaction.vout
        var output = outputs.find(o => (o.n == input.index))
        console.log("output is %o", output)
        //only when type: 'pubkeyhash'
        var address = output.scriptPubKey.addresses[0]
        var privKey = this.getPrivateKeys([address])
        console.log("private key for address %s is %o", address, privKey[address].toWIF())
        txBuilder.sign(0, privKey[address])
        console.log(txBuilder.build().toHex())

        // validate that the signing is good
        //Bitcoin.ECPair.fromPublicKeyBuffer(txb.inputs[0].pubKeys[0]).verify(tx.ins[0].hash, txb.inputs[0].signatures[0])
        //                                                             verify(tx.ins[0].hash, signature.signature)
        console.log("txb.inputs[0].pubKeys[0]:%o", txBuilder.inputs[0].pubKeys[0].toString('hex'))
        this.verifySignature(txBuilder.build().toHex())
      }) 
  })
}

BitcoinWallet.prototype.verifySignature = function(txInHex) {

  var tx = bitcoin.Transaction.fromHex(txInHex)
  console.log("tx: %o", tx)
  tx.ins.forEach(input => {
    var scriptSig = input.script
    console.log("scriptSig: %o (hex)", scriptSig.toString('hex'))
    console.log("scriptSig: %o ", scriptSig)
    var scriptChunks = bitcoin.script.decompile(scriptSig)
    scriptChunks.forEach(chunk => {
      console.log("each chunk: %o", chunk.toString('hex'))  
    })
    var publicKey = bitcoin.ECPair.fromPublicKeyBuffer(scriptChunks[1])
    console.log("bitcoin.script.pubKeyHash.input.check(scriptChunks):" + bitcoin.script.pubKeyHash.input.check(scriptChunks))
    var scriptSignature = bitcoin.script.scriptHash.input.decode(scriptChunks[0])

  })


    /*
      tx - inputs get script (scriptSig) + vin

    */

    // var tx = bitcoin.Transaction.fromHex('01000000020b668015b32a6178d8524cfef6dc6fc0a4751915c2e9b2ed2d2eab02424341c8000000006a47304402205e00298dc5265b7a914974c9d0298aa0e69a0ca932cb52a360436d6a622e5cd7022024bf5f506968f5f23f1835574d5afe0e9021b4a5b65cf9742332d5e4acb68f41012103fd089f73735129f3d798a657aaaa4aa62a00fa15c76b61fc7f1b27ed1d0f35b8ffffffffa95fa69f11dc1cbb77ef64f25a95d4b12ebda57d19d843333819d95c9172ff89000000006b48304502205e00298dc5265b7a914974c9d0298aa0e69a0ca932cb52a360436d6a622e5cd7022100832176b59e8f50c56631acbc824bcba936c9476c559c42a4468be98975d07562012103fd089f73735129f3d798a657aaaa4aa62a00fa15c76b61fc7f1b27ed1d0f35b8ffffffff02b000eb04000000001976a91472956eed9a8ecb19ae7e3ebd7b06cae4668696a788ac303db000000000001976a9146c0bd55dd2592287cd9992ce3ba3fc1208fb76da88ac00000000')

    // tx.ins.forEach(function (input, vin) {
    //   var script = input.script
    //   var scriptChunks = bitcoin.script.decompile(script)

    //   assert(bitcoin.script.pubKeyHash.input.check(scriptChunks), 'Expected pubKeyHash script')
    //   var prevOutScript = bitcoin.address.toOutputScript('1ArJ9vRaQcoQ29mTWZH768AmRwzb6Zif1z')
    //   var scriptSignature = bitcoin.script.signature.decode(scriptChunks[0])
    //   var publicKey = bitcoin.ECPair.fromPublicKeyBuffer(scriptChunks[1])

    //   var m = tx.hashForSignature(vin, prevOutScript, scriptSignature.hashType)
    //   assert(publicKey.verify(m, scriptSignature.signature), 'Invalid m')

    //   // store the required information
    //   input.signature = scriptSignature.signature
    //   input.z = bigi.fromBuffer(m)
    // })

}


BitcoinWallet.prototype.signRawTransaction = function(rawIncompleteTx) {
  //https://bitcoin.stackexchange.com/questions/64614/how-to-decode-transaction-inputs-from-raw-data-using-bitcoinjs-lib/65296
  var incompleteTx = bitcoin.Transaction.fromHex(rawIncompleteTx)
  incompleteTx.ins.forEach(input => {
    console.log("hash:%o, index:%i", reverse(input.hash).toString('hex'), input.index)
    BitcoinWallet.getTransaction(reverse(input.hash).toString('hex'))
      .then(transaction => {
        var outputs = transaction.vout
        var output = outputs.find(o => (o.n == input.index))
        console.log("output is %o", output)
        //only when type: 'pubkeyhash'
        var address = output.scriptPubKey.addresses[0]
        var privKey = this.getPrivateKeys([address])
        console.log("private key for address %s is %s", address, privKey[address])
        var txb = bitcoin.TransactionBuilder.fromTransaction(rawIncompleteTx, this.network)
        txb.sign(0, privKey)
        console.log(txb.build().toHex())
      })
    
  })
}

BitcoinWallet.getTransaction = function(txId) {
  return new Promise((resolve, reject) => {
    request('https://test-insight.bitpay.com/api/tx/' + txId,
      (error, response, body) => {
        try {
          console.log('https://test-insight.bitpay.com/api/tx/' + txId)
          //console.log("body:" + body)
          var tx = JSON.parse(body)
          //console.log("body parsed tx:%o", tx)
          resolve(tx)
        } catch (e) {
          reject (e)
        }
      }
    )
  })
}

//testWallet1()
//derivePrivateKey()
//importAndGenerateNewAddress()
//getXpubString("test")
//getNextPubAddress()

function start() {
  var bWallet = new BitcoinWallet("test")
  bWallet.init()
  bWallet.getNextPubAddress()
  bWallet.getPrivateKeys()
  //https://live.blockcypher.com/btc-testnet/tx/75a32c7e7806885895f5ad1663631540e142d5de6fa94ffb1d5d375edd511075/
  // var rawTxHex = bWallet.createRawTransaction([{"tx": "b3707e6fb74a6c993544974c6bbe557f97cbfa9882fcece1bc654bdfcfd0c21d", "tx_input_id":1}], 
  //                               [{"out_address": "mgJSLeR4Z7gfS7xJP3To66biwjnSvajaeK", "amount":24000000},{"out_address": "mfc81sQxy4ekUoaEVZahbDe3U5oUzAfNsV", "amount":24120000}])
  var rawTxHex = bWallet.createRawTransaction([{"tx": "75a32c7e7806885895f5ad1663631540e142d5de6fa94ffb1d5d375edd511075", "tx_input_id":0}], 
                                [{"out_address": "ms1U4MfbWyDhr48eHqyjpsH6ACGopcotye", "amount":11000000},{"out_address": "mik4Psy8VKyA47v8SHGV2K3Q371kR9f64z", "amount":12990000}])

  //bWallet.signRawTransaction(rawTxHex)
}


start()




