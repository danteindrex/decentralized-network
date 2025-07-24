import crypto from 'crypto'
import express from 'express'
import config from '../config'

const app = express();
app.use(express.json());
const webhookSecret = config.WEBHOOK_SECRET;

app.post("/webhook_url", function(req, res) {
  //validate event
  const hash = crypto.createHmac('sha512', webhookSecret).update(JSON.stringify(req.body)).digest('hex');
  if (hash == req.headers['x-bitnob-signature']) {
  // Retrieve the request's body
  const event = req.body;
  // Do something with event  
  }
  res.send(200);
});