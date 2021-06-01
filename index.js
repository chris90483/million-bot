require('dotenv').config();

const Discord = require('discord.js');
const client = new Discord.Client();


client.once('ready', () => {
   console.log('My body is ready'); 
});

client.on('message', message => {
    if (message.channel.name === "the-million-channel")
        console.log('Hey, it\'s a message in the million channel: ' + message.content);
});

client.login(process.env.TOKEN);