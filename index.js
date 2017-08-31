'use strict';
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const Reddit = require('./lib/reddit');

let messengerButton = "<html><head><title>Facebook Messenger Bot</title></head><body><h1>Facebook Messenger Bot</h1>This is a bot based on Messenger Platform QuickStart. For more details, see their <a href=\"https://developers.facebook.com/docs/messenger-platform/guides/quick-start\">docs</a>.<script src=\"https://button.glitch.me/button.js\" data-style=\"glitch\"></script><div class=\"glitchButton\" style=\"position:fixed;top:20px;right:20px;\"></div></body></html>";

// The rest of the code implements the routes for our Express server.
let app = express();
let max = 100;
let min = 1;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// Webhook validation
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === process.env.VERIFY_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }
});

// Display the web page
app.get('/', (req, res) => {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(messengerButton);
  res.end();
});

// Message processing
app.post('/webhook', (req, res) => {
  // console.log(req.body);
  let data = req.body;

  // Make sure this is a page subscription
  if (data.object === 'page') {
    
    // Iterate over each entry - there may be multiple if batched
    data.entry.forEach((entry) => {
      let pageID = entry.id;
      let timeOfEvent = entry.time;

      if (entry.messaging) {
        // Iterate over each messaging event
        entry.messaging.forEach((event) => {
          if (event.message) {
            receivedMessage(event);
          } else if (event.postback) {
            receivedPostback(event);   
          } else {
            console.log("Webhook received unknown event: ", event);
          }
        });
      } else {
        console.log("Webhook received unknown entry: ", entry);
      }
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know
    // you've successfully received the callback. Otherwise, the request
    // will time out and we will keep trying to resend.
    res.sendStatus(200);
  }
});

// Incoming events handling
function receivedMessage(event) {
  let senderID = event.sender.id;
  let recipientID = event.recipient.id;
  let timeOfMessage = event.timestamp;
  let message = event.message;

  console.log("Received message for user %d and page %d at %d with message:", 
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  let messageId = message.mid;

  let messageText = message.text;
  let messageAttachments = message.attachments;

  let quickReply = message.quick_reply;

  if (quickReply) {
    let payload = quickReply.payload;

    console.log(payload);

    let [type, number] = payload.split(':');

    switch (type) {
      case 'RANDOM':
        getRandomPost(senderID);
        break;
      case 'SPECIFIC':
        getSpecificPost(senderID, message.nlp, number);
        break;
      default:
        sendTextMessage(senderID, "I'm sorry. I'm still learning, and I couldn't figure out what you wanted me to do. Try 'hit me' or 'show me number 1.'", getHelpQuickReplies());
        break;
    }
    return;
  }

  if (message.nlp && message.nlp.entities && message.nlp.entities['greetings'] && message.nlp.entities['greetings'][0].confidence > 0.7) {
    handleGreeting(senderID);
    return;
  }

  if (messageText) {
    handleIntent(senderID, message.nlp);
  } else if (messageAttachments) {
    sendTextMessage(senderID, "That's wonderful, but I can't receive attachments at this time. :-/ Try replying 'random' to get a random post.", getHelpQuickReplies());
  }
}

function receivedPostback(event) {
  let senderID = event.sender.id;
  let recipientID = event.recipient.id;
  let timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback 
  // button for Structured Messages. 
  let payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " + 
    "at %d", senderID, recipientID, payload, timeOfPostback);

  // For now the only postback we receive is from an initial Get Started click.
  handleGreeting(senderID);
}

function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive 
}

function handleGreeting(senderID) {
  let greetings = [
    'Hello. 👋',
    'Hello.',
    '👋',
    'Hey. What\'s up?',
    'Hey. 👋',
    'Hey.',
    'What\'s happening?',
  ];
  let moreGreetings = [
    'Try getting a random post by replying \'random.\'',
    'You should check out the top post by replying \'first.\'',
    'Let me find you something interesting. When you\'re ready reply \'hit me,\' or try a quick reply below.'
  ];

  sendTextMessage(senderID, `${greetings[getRandomIntInclusive(0, greetings.length-1)]} ${moreGreetings[getRandomIntInclusive(0, moreGreetings.length-1)]}`, getHelpQuickReplies());
}

function getHelpQuickReplies() {
  let randomNumber = getRandomIntInclusive(min, max);

  return [{
    content_type: "text",
    title: "random",
    payload: "RANDOM"
  },{
    content_type: "text",
    title: "first",
    payload: "SPECIFIC:1"
  },{
    content_type: "text",
    title: randomNumber,
    payload: `SPECIFIC:${randomNumber}`
  }];
}

function handleIntent(senderID, nlp) {
  let intent = null;
  if (nlp && nlp.entities && nlp.entities['intent'] && nlp.entities['intent'][0].confidence > 0.8) {
    console.log(nlp.entities['intent'][0].value);
    intent = nlp.entities['intent'][0].value;
  }

  switch(intent) {
    case 'get_specific_post':
      getSpecificPost(senderID, nlp);
      break;
    case 'get_random_post':
      getRandomPost(senderID);
      break;
    case 'get_help':
      sendTextMessage(senderID, `Try replying with 'hit me' for a random post. You can also pick a number between ${min} and ${max}, and I'll grab that one for you.`, getHelpQuickReplies());
      break;
    default:
      let number = getNumber(nlp);
      if (number !== null) {
        getSpecificPost(senderID, nlp, number);
        return;
      }
      sendTextMessage(senderID, "Sorry. I'm still learning, and I couldn't figure out what you wanted me to do. Try 'hit me' or 'show me number 1.'", getHelpQuickReplies());
      break;
  }
}

function getNumber(nlp) {
  let types = ['ordinal','number'];
  let number = null;

  if (nlp && nlp.entities) {
    types.some((type) => {
      if (nlp.entities[type] && nlp.entities[type][0].confidence > 0.8) {
        number = nlp.entities[type][0].value;
        return true;
      }
    });
  }

  return number;
}

function getSpecificPost(senderID, nlp, numberIfKnown=null) {
  let number = numberIfKnown === null ? getNumber(nlp) : numberIfKnown;

  if (number !== null) {
    if (number > max) {
      sendTextMessage(senderID, "Right now I can only grab up to the 100th post. Fetching that one now...");
    } else if (number < min) {
      sendTextMessage(senderID, "Trying to trick me? ;-) Grabbing the first post now...");
    }
    sendTopPost(senderID, 'mildlyinteresting', false, number);
  } else {
    sendTextMessage(senderID, "I'm sorry. I'm still learning, and I couldn't tell which one you wanted me to show you. Try 'hit me' or 'show me number 1.'", getHelpQuickReplies());
  }
}

function getRandomPost(senderID) {
  sendTopPost(senderID, 'mildlyinteresting', true);
}

//////////////////////////
// Sending helpers
//////////////////////////
function sendTopPost(recipientId, subreddit, random, index) {
  let red = new Reddit();

  red.getTopPosts(subreddit, random, index)
    .then((data) => {
      console.log(data);
      callSendAPI(prepRichPost(recipientId, data));
    })
    .catch((err) => {
      console.error(err);
    });
}

function prepRichPost(recipientId, post) {

  let imgurRegEx = /https?:\/\/imgur\.com/i;
  let link = `https://reddit.com${post.permalink}`;
  let url = post.url.match(imgurRegEx) ? post.thumbnail : post.url;

  let quickReplies = [{
    content_type: "text",
    title: "random",
    payload: "RANDOM"
  }];

  if (post.number < max) {
    quickReplies.push({
      content_type: "text",
      title: "next",
      payload: `SPECIFIC:${(post.number*1)+1}`
    });
  }
  if (post.number > min) {
    quickReplies.unshift({
      content_type: "text",
      title: "previous",
      payload: `SPECIFIC:${(post.number*1)-1}`
    });
  }

  let messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: post.title,
            subtitle: `${post.subreddit_name_prefixed}\nrank: ${post.number}\nscore: ${post.score}\n`,
            item_url: link,
            image_url: url,
            buttons: [{
              type: "web_url",
              url: link,
              title: "Open Reddit Post"
            },{
              type: "web_url",
              url: post.url,
              title: "Open Image"
            }],
          }]
        }
      },
      quick_replies: quickReplies
    }
  }; 

  return messageData;
}

function sendTextMessage(recipientId, messageText, quickReplies=null) {
  let messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };

  console.log(quickReplies, typeof quickReplies);
  if (quickReplies !== null) {
    messageData.message.quick_replies = quickReplies;
  }

  callSendAPI(messageData);
}

function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.10/me/messages',
    headers: {
      'Authorization': `Bearer ${process.env.PAGE_ACCESS_TOKEN}`
    },
    method: 'POST',
    json: messageData

  }, (error, response, body) => {
    if (!error && response.statusCode == 200) {
      let recipientId = body.recipient_id;
      let messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s", 
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });  
}

// Set Express to listen out for HTTP requests
let server = app.listen(process.env.PORT || 3000, () => {
  console.log("Listening on port %s", server.address().port);
});