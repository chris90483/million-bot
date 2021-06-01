require('dotenv').config();

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
    if (message.member.id === lastMessage.member.id) {
       console.log('❌ Message is not authored by a different member.');
       return false;
    }
    return true;
}

function check(message) {
    if (lastMessage === undefined || lastMessage === null) {
        lastMessage = message;
        return;
    }
   currInt = parseInt(message.content);
   prevInt = parseInt(lastMessage.content);
   
   const allChecksPassed = isNotNaN(currInt) 
                        && isNextNumber(currInt, prevInt) 
                        && isDifferentMember(message);
   
   if (allChecksPassed) {
        lastMessage = message;
        lastMessage.react('✅');
   } else {
       message.delete();
   }
}

client.once('ready', () => {
    console.log('My body is ready. Fetching the last message..');
    lastMessage = client.channels.cache.find(channel => channel.id == process.env.CHANNEL_ID).lastMessage;
    console.log(lastMessage.content);
});
    

client.on('message', message => {
    if (message.channel.name === "the-million-channel") {
        console.log('Hey, it\'s a message in the million channel: ' + message.content);
        check(message);
    }
});

client.login(process.env.TOKEN);