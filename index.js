require('dotenv').config();

const Discord = require('discord.js');
const client = new Discord.Client();

function check(channel) {
    channel.messages.fetch({limit: 2})
        .then(messages => {
            if (messages.length < 2) return;
            let curr = undefined; 
            let prev = undefined;
            messages.forEach(fetchedMessage => {
                if (fetchedMessage.id === channel.lastMessageID) {
                    curr = fetchedMessage;
                } else {
                    prev = fetchedMessage;
                }
            });
            console.log(`curr: ${curr.content} prev: ${prev.content}`);
           
           currInt = parseInt(curr);
           prevInt = parseInt(prev);
           if (isNaN(currInt)) {
               console.log('Couldn\'t parse message as int, deleting...');
               curr.delete();
           }
           if (currInt != prevInt + 1) {
               console.log('Wrong number, deleting...');
               curr.delete();
           }
        })
        .catch(error => {
            console.log("    ERROR: " + error);
        });
}

client.once('ready', () => {
   console.log('My body is ready'); 
});

client.on('message', message => {
    if (message.channel.name === "the-million-channel") {
        console.log('Hey, it\'s a message in the million channel: ' + message.content);
        check(message.channel);
    }
});

client.login(process.env.TOKEN);