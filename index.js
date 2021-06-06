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

import * as tesseract from 'node-tesseract-ocr';
/**
* @const {Object} userStats - object containing statistics on users that logs activity regarding the counting channel.
*/
const userStats = JSON.parse(fs.readFileSync('./data/userStats.json'));
/**
* @const {Object} tesseractConfig - configuration used for running tesseract OCR commands.
*/
const tesseractConfig = JSON.parse(fs.readFileSync('tesseractConfig.json'));

import nodeCleanup from 'node-cleanup';
import * as Discord from 'discord.js';
/**
* @const {Object} client - The discordjs client that acts as the gateway to the Discord API.
*/
const client = new Discord.Client();

const AVAILABLE_COMMANDS = {
  '!million-help': showHelp,
  '!million-stats': showStats,
  '!million-progress': showMillionProgress,
};
let lastMessage = undefined;

/**
* Is not NaN check, with a log when it was NaN.
* Used in various checking functions.
* @param {number} number - The number.
* @return {boolean} the is-not-NaN flag
*/
function isNotNaN(number, printMessage = true) {
  if (isNaN(number)) {
    if (printMessage) console.log('❔ Message is NaN');
    return false;
  }
  return true;
}

/**
* Function that checks wheter the next number is the successor of the previous.
* It includes a log when it isn't.
* Used in {@link runChecks} and in {@link runChecksOCR}.
* @param {number} currInt - The number being checked.
* @param {number} prevInt - The parsed number from the {@link lastMessage| last message}.
* @return {boolean} the is-next-number flag
*/
function isNextNumber(currInt, prevInt, printMessage = true) {
  if (currInt !== prevInt + 1) {
    if (printMessage) console.log(`❔ Message is not previous + 1 (curr: ${currInt} prev: ${prevInt})`);
    return false;
  }
  return true;
}

/**
* Function that checks wheter the message is authored by another memeber than the last message.
* It skips this check (returns true) when the author is a bot. It includes a log when the check isn't passed.
* Used in {@link runChecks}.
* @param {Object} message - The message under review
* @return {boolean} the is-different-member flag
*/
function isDifferentMember(message, printMessage = true) {
  if (lastMessage && lastMessage.author.bot) {
    return true;
  }

  if (lastMessage && message.author.id === lastMessage.author.id) {
    if (printMessage) console.log('❌ Message is not authored by a different member.');
    return false;
  }
  return true;
}

/**
* Function that checks wheter the message can be parsed and evaluated into the next number in the counting channel.
* @param {string} messageContent - The text from the message under review.
* @param {string} prevInt - The retrieved previous number from the counting channel (obtained by calling {@link getLastInt}).
* @return {boolean} whether it can be evaluated to the next number.
*/
function canBeParsedAsNextNumber(messageContent, prevInt, printMessage = true) {
  const evaluatedResult = evaluate(messageContent);
  if (evaluatedResult === prevInt + 1) {
    if (printMessage) console.log(`✔️ Message approved, it evaluates to the next number (${evaluatedResult})!`);
    return true;
  } else {
    if (printMessage) console.log(`❌ Message doesn't evaluate to the next number (${evaluatedResult})`);
    return false;
  }
}

/**
* Function that retrieves the number from the last message.
* When it couldn't successfully retrieve the lat number it returns -1.
* A callback is used here because the {@link runChecksOCR} function uses callbacks.
* @param {function} callBack - callBack the result is passed to.
*/
function getLastInt(callBack) {
  if (lastMessage !== undefined || lastMessage !== null) {
    if (!isNaN(parseInt(lastMessage.content))) {
      callBack(parseInt(lastMessage.content));
      return;
    }
    const result = evaluate(lastMessage.content);
    if (!isNaN(result)) {
      callBack(result);
      return;
    }
    const attachments = lastMessage.attachments.filter((attachment) => attachment.url.indexOf('png' !== -1) || attachment.url.indexOf('jpg' !== -1) || attachment.url.indexOf('jpeg' !== -1));
    if (attachments.size > 0) {
      tesseract
          .recognize(attachments.first().url, tesseractConfig)
          .then((text) => {
            const tesseractResult = evaluate(text);
            if (typeof tesseractResult === 'number' && tesseractResult > 0) {
              callBack(tesseractResult);
              return;
            }
          })
          .catch((error) => {
            console.log(error.message);
            callBack(-1);
            return;
          });
      return;
    }
  }
  callBack(-1);
}

/**
* Function that evaluates an expression and returns the calculated result.
* The evalation is done by the {@link ExpressionEvaluator} class from the antlr module.
* The grammar used by this evaluator is found in antlr/expression/Expression.g4.
* @param {string} textInput - the expression text to evaluate.
* @return {number} the number that the evaluator evaluated to.
*/
function evaluate(textInput) {
  const chars = new antlr4.InputStream(textInput);
  const lexer = new ExpressionLexer(chars);
  const tokens = new antlr4.CommonTokenStream(lexer);
  const parser = new ExpressionParser(tokens);
  // here's a bunch of hacks to prevent antlr from cluttering the console...
  lexer.notifyListeners = (e) => {};
  parser._errHandler.reportError = (a) => {};
  const tree = parser.expression();
  const evaluator = new ExpressionEvaluator();
  antlr4.tree.ParseTreeWalker.DEFAULT.walk(evaluator, tree);
  return evaluator.results[tree];
}

/**
* Function that shows statistics for the author of the passed message in Discord.
* The statistics are retrieved from the {@link userStats} global variable.
* The bot sends the message to the channel the author posted in.
* This channel can never be the counting channel, as this is checked in the on-message event handler.
* @param {Object} message - the message the bot is acting on.
*/
function showStats(message) {
  const theirStats = userStats.hasOwnProperty(message.author.id) ?
                        userStats[message.author.id] :
                        {};
  let botMessage =
  `Stats for ${message.author.username}#${message.author.discriminator}: \n`;
  for (const prop in theirStats) {
    if (theirStats.hasOwnProperty(prop)) {
      botMessage += `  ${prop}: ${theirStats[prop]}\n`;
    }
  }
  message.channel.send(botMessage);
}

/**
* Function that shows a summary of available bot commands in Discord.
* @param {Object} message - the message the bot is acting on.
*/
function showHelp(message) {
  message.channel.send(`Available commands: ${Object.keys(AVAILABLE_COMMANDS).reduce((a, b) => `${a}, ${b}`)}`);
}

/**
* Function that shows the progress to a million as percentage, in Discord.
* Doesn't work when the last number was not successfully retrieved. The bot handles this by replying with a generic error message.
* @param {Object} message - the message the bot is acting on.
*/
function showMillionProgress(message) {
  getLastInt((lastInt) => {
    if (lastInt === -1) {
      message.channel.send('Currently unavailable. Try again later.');
      return;
    }
    const percentage = (lastInt / 10000);
    message.channel.send(`We are ${percentage}% done now!`);
  });
}

/**
* Function that logs activity related to the counting channel.
* the stats are stored in {@link userStats}.
* @param {Object} message - the message the bot is acting on.
*/
function addStats(message) {
  if (userStats.hasOwnProperty(message.author.id)) {
        userStats[message.author.id].hasOwnProperty('amountCounted') ?
            userStats[message.author.id].amountCounted += 1 :
            userStats[message.author.id].amountCounted = 1;
  } else {
    userStats[message.author.id] = {'amountCounted': 1};
  }
}

function runChecksOCR(attachment, checkCallbackFunction, returnType, printMessage = true) {
  if (printMessage) console.log('   [OCR] - running OCR...');
  tesseract
      .recognize(attachment.url, tesseractConfig)
      .then((text) => {
        if (printMessage) console.log(`   [OCR] - OUTPUT: ${text}`);
        const currInt = parseInt(text);
        getLastInt((prevInt) => {
          if (isNotNaN(currInt, false)) {
            if (prevInt !== -1 && isNextNumber(currInt, prevInt, false)) {
              if (printMessage) console.log('   [OCR] - ✔️ Image approved, it\'s the next number!');
              checkCallbackFunction(returnType === 'boolean' ? true : currInt);
              return;
            }
          }
          if (prevInt !== -1 && canBeParsedAsNextNumber(text, prevInt, false)) {
            if (printMessage) console.log('   [OCR] - ✔️ Image approved, it can be parsed as the next number!');
            checkCallbackFunction(returnType === 'boolean' ? true : evaluate(text));
            return;
          }
          if (printMessage) console.log('   [OCR] - ❌ Image rejected.');
          checkCallbackFunction(returnType === 'boolean' ? false : -1);
          return;
        });
      })
      .catch((error) => {
        console.log(error.message);
        checkCallbackFunction(returnType === 'boolean' ? false : -1);
        return;
      });
}

function runChecks(message, checkCallbackFunction) {
  const currInt = parseInt(message.content);
  getLastInt((prevInt) => {
    if (isDifferentMember(message)) {
      if (isNotNaN(currInt)) {
        if (prevInt === -1) {
          // Couldn't retrieve the last number, so we can't run checks.
          // Approve the message.
          checkCallbackFunction(true);
          return;
        }
        // ok seems cool over here. If it's the next number in line we can approve it!
        if (isNextNumber(currInt, prevInt)) {
          console.log('✔️ Message approved, it\'s the next number!');
          checkCallbackFunction(true);
          return;
        }
      }
      // is NaN or is not next number, try parsing if the previous number is known.
      if (prevInt !== - 1 && canBeParsedAsNextNumber(message.content, prevInt)) {
        checkCallbackFunction(true);
        return;
      }

      // retry with OCR, if there is an attachment
      const pngAttachments = message.attachments.filter((attachment) => attachment.url.indexOf('png' !== -1) || attachment.url.indexOf('jpg' !== -1) || attachment.url.indexOf('jpeg' !== -1));
      if (pngAttachments.size > 0) {
        runChecksOCR(pngAttachments.first(), checkCallbackFunction, 'boolean');
        return;
      }
    }
    // not different member, or no satisfied requirements
    checkCallbackFunction(false);
    return;
  });
}

function handleMessageInOtherChannel(message) {
  if (message.author.bot) return;
  const cmdMessage = message.content.toLowerCase();

  for (const key in AVAILABLE_COMMANDS) {
    if (AVAILABLE_COMMANDS.hasOwnProperty(key) && cmdMessage.indexOf(key) !== -1) {
      AVAILABLE_COMMANDS[key](message);
      return;
    }
  }
  if (cmdMessage.indexOf('!million-') !== -1) {
    message.channel.send(`Unknown command. Available commands: ${Object.keys(AVAILABLE_COMMANDS).reduce((a, b) => `${a}, ${b}`)}`);
  }
}

function handleMessageInMillion(message) {
  if (message.author.bot) return;
  console.log(`User ${message.author.username} sent ${message.content}`);
  if (lastMessage === undefined || lastMessage === null) {
    console.log(`bug: lastMessage: ${lastMessage}`);
    lastMessage = message;
    return;
  }


  runChecks(message, (messageApproved) => {
    if (messageApproved) {
      lastMessage = message;
      addStats(message);
    } else {
      message.delete().then((m)=>{}).catch((error)=>{
        console.log(`deletion error: ${error}`);
      });
    }
  });
}

function fetchLastMessage() {
  console.log('Fetching the last message..');
  const millionChannel = client.channels.cache
      .find((channel) => channel.name.toLowerCase() == 'the-million-channel');

  millionChannel.messages.fetch({limit: 2})
      .then((messages) => {
        console.log(`Found it! It's ${messages
            .filter((message) => !message.author.bot).first().content.length > 0 ? messages
                .filter((message) => !message.author.bot).first().content : '<empty message>'}`);
        lastMessage = messages
            .filter((message) => (!message.author.bot)).first();
      })
      .catch(console.error);
}


/**
* Discordjs client event handlers.
*/

client.once('ready', () => {
  console.log('Connection successful.');
  fetchLastMessage();
});


client.on('message', (message) => {
  if (message.channel.name === 'the-million-channel') {
    handleMessageInMillion(message);
  } else {
    handleMessageInOtherChannel(message);
  }
});

client.on('messageUpdate', (oldMessage, newMessage) => {
  if (newMessage.channel.name === 'the-million-channel') {
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
  }
});

/**
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
