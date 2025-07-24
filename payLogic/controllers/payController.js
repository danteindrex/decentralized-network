// send and recieve bitcoin transactions
// build our won bitcoin and lightning payment processor
// integrate bitcoin wallets int6o our products
// securely store bitcoin
// real-time notigications of wallet transactions
// verify requests using API key
import axios from "axios"
import config from '../config.js';

export const sendBitcoin = async (address,email) => {
    const options = {
        method: 'POST',
        url: 'https://sandboxapi.bitnob.co/api/v1/wallets/send_bitcoin',
        headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${config.API-KEY}`
        },
        data: {
        satoshis: 3000,
        address: `${address}`,
        customerEmail: `${email}`,
        description: 'string',
        priorityLevel: 'regular'
        }
    };
    
    axios
    .request(options)
    .then(function (response) {
    console.log(response.data);
    })
    .catch(function (error) {
    console.error(error);
    });
}
 