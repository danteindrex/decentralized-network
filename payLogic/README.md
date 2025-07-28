## PAY LOGIC DEFINED
### SENDING BITCOIN
Fuction to execute bitcoin transfers to IPFS agents

**RESPONSE**
```json
{
"status": true,
"message": "Transaction successfully submitted",
"data": {
  "reference": "f34929892acc",
  "description": "lorem ipsum",
  "amount": "1.44",
  "fees": "0",
  "btcFees": "0.0000001",
  "btcAmount": "0.00003",
  "satFees": "10",
  "satAmount": "3000",
  "spotPrice": "47950.95",
  "address": "tb1qxnckwtxw88cznfs2hxgc0789ku2h3h05v62zcr",
  "action": "send_bitcoin",
  "type": "debit",
  "status": "pending",
  "channel": "onchain",
  "hash": null,
  "confirmations": null,
  "paymentRequest": null,
  "invoiceId": null,
  "id": "07f0328d-e4d5-4a29-8b71-f8b797d9666f",
  "createdAt": "2021-09-16T10:10:33.128Z",
  "updatedAt": "2021-09-16T10:10:33.128Z"
}
}
```

### CREATING PAYEMENT INVOICE 
Function to initiate a payement invoice to a customer to pay for their storage

**RESPONSE**
```json
{
"status": true,
"message": "lightning invoice successfully created",
"data": {
  "description": "money stops nonsense on sunday",
  "request": "lntb19300n1ps5xzcypp5jcksjkjpupn7pfzkqacm8tpsyz9dd24akpcmv3rvyljx7fqqnh8sdpsd4hkueteypehgmmswvsxummwwdjkuum9yphkugrnw4hxgctecqzpgxqr23sfppqwnu34jgs5j07h2k55vue7w9fctu7r7g4sp5ffjp2mnr3x3kjrfm678twu0agnk5hpf4n7st7u72q9r43d5nwwrs9qyyssqswxaw2au37dyzdgs7rkvllrlel4dnn68z7tkd8m4tfgmytwv23mrma7zh505szyy6u5tlydtujcljfeppfv7q2mvxuzlys5r4javcrqpvxdphm",
  "tokens": "1000"
}
}
```