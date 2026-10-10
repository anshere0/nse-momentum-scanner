require('dotenv').config();
const { DhanFeed, Quote } = require('dhanhq');
const WebSocket = require('ws');

const clientId = process.env.DHAN_CLIENT_ID;
const token = process.env.DHAN_ACCESS_TOKEN;

console.log("Client ID:", clientId);

const url = `wss://api-feed.dhan.co?version=2&token=${token}&clientId=${clientId}&authType=2`;
const ws = new WebSocket(url);

const dhanFeed = new DhanFeed(clientId, token, [], Quote);

ws.on('open', () => {
  console.log("Connected to native WS!");
  // To subscribe, DhanFeed creates a packet
  const packet = dhanFeed.createSubscriptionPacket([[2, '13']], Quote, true);
  ws.send(packet);
});

ws.on('message', (data) => {
  const code = data.readUInt8(0);
  console.log("Response code:", code);
  if (code === 4) {
    console.log(dhanFeed.processQuotePacket(data));
  } else if (code === 5) {
    console.log(dhanFeed.processOIDataPacket(data));
  }
});

ws.on('error', (err) => console.error("WS ERROR:", err));
ws.on('close', (c, r) => console.log("WS CLOSE:", c, r.toString()));
