import * as dotenv from 'dotenv';
dotenv.config();

import * as antlr4 from 'antlr4';
import ExpressionLexer from './antlr/expression/ExpressionLexer.js';
import ExpressionParser from './antlr/expression/ExpressionParser.js';
import ExpressionEvaluator from './antlr/ExpressionEvaluator.js';


import * as fs from 'fs';
if (!fs.existsSync('./data/userStats.json')) {
  fs.writeFileSync('./data/userStats.json', JSON.stringify({}));
  console.log('userStats.json didn\'t exist and was created.');
}


const userStats = JSON.parse(fs.readFileSync('./data/userStats.json'));
import nodeCleanup from 'node-cleanup';
import * as Discord from 'discord.js';
const client = new Discord.Client();

let lastMessage = undefined;

function isNotNaN(number) {
  if (isNaN(number)) {
    console.log('❔ Message is NaN');
    return false;
  }
  return true;
}

function isNextNumber(currInt, prevInt) {
  if (currInt !== prevInt + 1) {
    console.log('❔ Message is not previous + 1');
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
    const result = evaluate(lastMessage.content);
    if (isNotNaN(result)) {
      return result;
    }
  }
  return -1;
}

function evaluate(textInput) {
    const chars = new antlr4.InputStream(textInput);
    const lexer = new ExpressionLexer(chars);
    const tokens = new antlr4.CommonTokenStream(lexer);
    const parser = new ExpressionParser(tokens);
    parser.buildParseTrees = true;
    const tree = parser.expression();
    const evaluator = new ExpressionEvaluator();
    antlr4.tree.ParseTreeWalker.DEFAULT.walk(evaluator, tree);
    return evaluator.results[tree];
}

function showStats(message) {
  const theirStats = userStats.hasOwnProperty(message.author.id) ?
                        userStats[message.author.id] :
                        {};
  botMessage =
  `Stats for ${message.author.username}#${message.author.discriminator}: \n`;
  for (const prop in theirStats) {
    if (theirStats.hasOwnProperty(prop)) {
      botMessage += `  ${prop}: ${theirStats[prop]}\n`;
    }
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

function canBeParsedAsNextNumber(message, prevInt) {
    const evaluatedResult = evaluate(message.content);
    if (evaluatedResult === prevInt + 1) {
        console.log(`✔️ Message approved, it evaluates to the next number (${evaluatedResult})!`);
        return true;
    } else {
        console.log(`❌ Message doesn't evaluate to the next number (${evaluatedResult})`);
        return false;
    }
}

function runChecks(message) {
  const currInt = parseInt(message.content);
  const prevInt = getLastInt();
  const isNumber = isNotNaN(currInt);
  
  if (isDifferentMember(message)) {
      if (isNotNaN(currInt)) {
          if (isNextNumber(currInt, prevInt)) {
              console.log('✔️ Message approved, it\'s the next number!');
              return true;
          }
      }
      // is NaN or is not next number, try parsing
      return canBeParsedAsNextNumber(message, prevInt);   
  }
   // not next member, always false
  return false;
}

function handle(message) {
  if (message.author.bot) return;
  console.log(`User ${message.author.username} sent ${message.content}`);
  if (lastMessage === undefined || lastMessage === null) {
    console.log(`bug: lastMessage: ${lastMessage}`);
    lastMessage = message;
    return;
  }
  
  if (runChecks(message)) {
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
  const millionChannel = client.channels.cache
      .find((channel) => channel.name.toLowerCase() == 'the-million-channel');

  millionChannel.messages.fetch({limit: 2})
      .then((messages) => {
        console.log(`Found it! It's ${messages
            .filter((message) => !message.author.bot).first().content}`);
        lastMessage = messages
            .filter((message) => (!message.author.bot)).first();
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
  console.log(`Detected a message update: User 
    ${newMessage.author.username} changed 
    ${oldMessage.content} to ${newMessage.content}.`);

  if (!isNotNaN(parseInt(newMessage.content))) {
    newMessage.delete().then((m) => {
      fetchLastMessage();
    });
  } else {
    console.log('✔️ Edit approved!');
  }
});

/*
 * Main section
 */

client.login(process.env.TOKEN);

nodeCleanup((exitCode, signal) => {
  fs.writeFileSync('./data/userStats.json',
      JSON.stringify(userStats),
      (err) => {
        if (err) console.error(`${err}`);
        console.log('Saved user stats, exiting.');
      });
});
