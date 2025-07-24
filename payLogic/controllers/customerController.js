import axios from 'axios'
import config from '../config'

export const createCustomer = (payload) => {
    const options = {
    method: 'POST',
    url: 'https://sandboxapi.bitnob.co/api/v1/customers/',
    headers: {
    accept: 'application/json',
    'content-type': 'application/json',
    Authorization: `Bearer ${config.API_KEY}`
    },
    data: payload
    };
    
    axios
    .request(options)
    .then(function (response) {
    return response.data;
    })
    .catch(function (error) {
    console.error(error);
    return error;
    });
}
 
export const getCustomer = (customerId) => {
    const options = {
    method: 'GET',
    url: `https://sandboxapi.bitnob.co/api/v1/customers/${customerId}`,
    headers: {accept: 'application/json', Authorization: `Bearer ${config.API-KEY}`}
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