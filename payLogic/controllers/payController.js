// send and recieve bitcoin transactions
// build our won bitcoin and lightning payment processor
// integrate bitcoin wallets int6o our products
// securely store bitcoin
// real-time notigications of wallet transactions
// verify requests using API key
import axios from "axios"
import config from '../config.js';
import { btctosatoshi } from '../utils/btcConverter.js';

// send bitcoin to IPFS agents
export const sendBitcoin = async (address,email,btc) => {
    const options = {
        method: 'POST',
        url: 'https://sandboxapi.bitnob.co/api/v1/wallets/send_bitcoin',
        headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${config.API-KEY}`
        },
        data: {
        satoshis: btctosatoshi(btc),
        address: address,
        customerEmail: email,
        description: 'Gas fees',
        priorityLevel: 'regular'
        }
    };
    
    axios
    .request(options)
    .then(function (response) {
    console.log(response.data);
    return response.data
    })
    .catch(function (error) {
    console.error(error);
    return error
    });
}
 
// generate lightning invoice when a month has elapsed (claculate amount to be payed based on storage and place that here)
// send qr code and pay link to user to scan or copy to bitcoin wallet

export const createInvoice = async ({email,btc}) => {
    const options = {
    method: 'POST',
    url: 'https://sandboxapi.bitnob.co/api/v1/wallets/ln/createinvoice',
    headers: {
    accept: 'application/json',
    'content-type': 'application/json',
    Authorization: `Bearer ${config.API-KEY}`
    },
    data: {
    satoshis: btctosatoshi(btc),
    customerEmail: email,
    description: 'Customer storage payement invoice',
    expiresAt: '24h',
    }
    };
    
    axios
    .request(options)
    .then(function (response) {
    console.log(response.data);
    return response.data
    })
    .catch(function (error) {
    console.error(error);
    return error
    });
}

 