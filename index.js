require('dotenv').config();

const fs = require('fs');
if (!fs.existsSync('./data/userStats.json')) {
	fs.writeFileSync('./data/userStats.json', JSON.stringify({}));
	console.log("userStats.json didn't exist and was created.");
}
const userStats = require('./data/userStats');
const nodeCleanup = require('node-cleanup');
const Discord = require('discord.js');

const client = new Discord.Client();
let lastMessage = undefined;

function isNotNaN(number) {
  if (isNaN(number)) {
    console.log('❌ Message is NaN');
    return false;
  }
  return true;
}

function isNextNumber(currInt, prevInt) {
  if (currInt !== prevInt + 1) {
    console.log('❌ Message is not previous + 1');
    return false;
  }
  return true;
}

function isDifferentMember(message) {
  if (lastMessage && lastMessage.author.bot) {
    return true;
  }
  
  if (lastMessage && message.author.id === lastMessage.author.id) {
    console.log('❌ Message is not authored by a different member.');
    return false;
  }
  return true;
}

function getLastInt() {
  if (lastMessage !== undefined || lastMessage !== null) {
    const result = parseInt(lastMessage.content);
    if (isNotNaN(result)) {
      return result;
    }
  }
  return -1;
}

function showStats(message) {
  const theirStats = userStats.hasOwnProperty(message.author.id) ? userStats[message.author.id] : {};
  botMessage = `Stats for ${message.author.username}#${message.author.discriminator}: \n`;
  for (const prop in theirStats) {
    botMessage += `  ${prop}: ${theirStats[prop]}\n`;
  }
  message.channel.send(botMessage);
}

function addStats(message) {
  if (userStats.hasOwnProperty(message.author.id)) {
        userStats[message.author.id].hasOwnProperty('amountCounted') ?
            userStats[message.author.id].amountCounted += 1 :
            userStats[message.author.id].amountCounted = 1;
  } else {
    userStats[message.author.id] = {'amountCounted': 1};
  }
}

function runChecks(message) {
    const currInt = parseInt(message.content);
    const prevInt = getLastInt();
    return isNotNaN(currInt) &&
           isNextNumber(currInt, prevInt) &&
           isDifferentMember(message);
}

function handle(message) {
  if (message.author.bot) return;
  console.log(`User ${message.author.username} sent ${message.content}`);
  if (lastMessage === undefined || lastMessage === null) {
    console.log(`bug: lastMessage: ${lastMessage}`);
    lastMessage = message;
    return;
  }

  const allChecksPassed = runChecks(message);

  if (allChecksPassed) {
    console.log("✔️ Message approved!");
    lastMessage = message;
    if (message.content.toLowerCase().indexOf('!stats') !== -1) {
      showStats(message);
    }

    addStats(message);
  } else {
    message.delete();
  }
}

function fetchLastMessage() {
    console.log('Fetching the last message..');
  const millionChannel = client.channels.cache.find((channel) => channel.name.toLowerCase() == 'the-million-channel');

  millionChannel.messages.fetch({limit: 2})
      .then((messages) => {
        console.log(`Found it! It's ${messages.filter((message) => !message.author.bot).first().content}`);
        lastMessage = messages.filter((message) => (!message.author.bot)).first();
      })
      .catch(console.error);
}

client.once('ready', () => {
  console.log('Connection successful.');
  fetchLastMessage();
});


client.on('message', (message) => {
  if (message.channel.name === 'the-million-channel') {
    handle(message);
  }
});

client.on('messageUpdate', (oldMessage, newMessage) => {
   console.log(`Detected a message update: User ${newMessage.author.username} changed ${oldMessage.content} to ${newMessage.content}.`);
   
   if (!isNotNaN(parseInt(newMessage.content))) {
       newMessage.delete().then((m) => {
          fetchLastMessage(); 
       });
   } else {
       console.log("✔️ Edit approved!");
   }
});

/*
 * Main section
 */

client.login(process.env.TOKEN);

nodeCleanup((exitCode, signal) => {
  fs.writeFileSync('./data/userStats.json', JSON.stringify(userStats), function(err) {
    if (err) console.error(`${err}`);
    console.log('Saved user stats, exiting.');
  });
});
