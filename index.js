const express = require('express');
require('dotenv').config();

const app = express();

app.get('/', function (req, res) {
  res.send('Hello World!');
});

app.get('/webhook', function (req, res) {
  if (req.query['hub.verify_token'] === process.env.VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.send('Error, wrong validation token');
  }
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});