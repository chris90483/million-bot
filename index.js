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

import Logger from './logger.js';
import * as tesseract from 'node-tesseract-ocr';
import nodeCleanup from 'node-cleanup';
import * as Discord from 'discord.js';

// ///////////
// Globals //
// ///////////
const logger = new Logger();

/**
* @const {Object} userStats - object containing statistics on users that logs activity regarding the counting channel.
*/
const userStats = JSON.parse(fs.readFileSync('./data/userStats.json'));
/**
* @const {Object} tesseractConfig - configuration used for running tesseract OCR commands.
*/
const tesseractConfig = JSON.parse(fs.readFileSync('tesseractConfig.json'));
/**
* @const {Object} client - The discordjs client that acts as the gateway to the Discord API.
* it logs in with a bot token, provided by the dotenv.
*/
const client = new Discord.Client();
/**
* @const {Object} AVAILABLE_COMMANDS - object that maps command strings to functions that handle those commands.
*/
const AVAILABLE_COMMANDS = {
  '!million-help': showHelp,
  '!million-stats': showStats,
  '!million-progress': showMillionProgress,
};
/**
* @const {string} COUNTING_CHANNEL_NAME - The name of the counting channel on the Discord server.
*/
const COUNTING_CHANNEL_NAME = 'count-to-a-million';
/**
* {Object} lastMessage - Last message sent the the counting channel (a discordjs message).
*/
let lastMessage = undefined;


// /////////////
// Functions //
// /////////////

/**
* Function that checks wheter the message is authored by another memeber than the last message.
* It skips this check (returns true) when the author is a bot. It includes a log when the check isn't passed.
* Used in {@link runChecks}.
* @param {Object} message - The discordjs Message under review
* @param {string} printMessage - Flag to enable/disable console.log calls, defaults to true (meaning with logging).
* @return {boolean} the is-different-member flag
*/
function isDifferentMember(message, printMessage = true) {
  // we don't care about this if the author is a bot
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
* @param {string} printMessage - Flag to enable/disable console.log calls, defaults to true (meaning with logging).
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
* When this function is called the {@link lastMessage} variable <i>should</i> be initialized.
* A callback is used here because the {@link runChecksOCR} function uses callbacks.
* @param {function} callBack - callBack the result is passed to.
*/
function getLastInt(callBack) {
  if (lastMessage !== undefined || lastMessage !== null) {
    // try evaluating
    const result = evaluate(lastMessage.content);
    if (!isNaN(result)) {
      callBack(result);
      return;
    }
    // try OCR
    const attachments = lastMessage.attachments.filter(
        (attachment) => attachment.url.indexOf('png' !== -1) ||
                                    attachment.url.indexOf('jpg' !== -1) ||
                                    attachment.url.indexOf('jpeg' !== -1),
    );
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
            logger.logError('getLastInt() tesseract error: ' + error.message);
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
  // ok here we go
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
* @param {Object} message - the discordjs Message the bot is acting on.
*/
function showStats(message) {
  const theirStats = userStats.hasOwnProperty(message.author.id) ?
                        userStats[message.author.id] :
                        {};
  let botMessage =
  `Stats for ${message.author.username}#${message.author.discriminator}: \n`;
  if (theirStats !== {}) {
    for (const prop in theirStats) {
      if (theirStats.hasOwnProperty(prop)) {
        botMessage += `  ${prop}: ${theirStats[prop]}\n`;
      }
    }
  } else {
    botMessage += '  No stats yet for this user';
  }
  message.channel.send(botMessage);
}

/**
* Function that shows a summary of available bot commands in Discord.
* @param {Object} message - the discordjs Message the bot is acting on.
*/
function showHelp(message) {
  message.channel.send(`Available commands: ${Object.keys(AVAILABLE_COMMANDS).reduce((a, b) => `${a}, ${b}`)}`);
}

/**
* Function that shows the progress to a million as percentage, in Discord.
* Doesn't work when the last number was not successfully retrieved. The bot handles this by replying with a generic error message.
* @param {Object} message - the discordjs Message the bot is acting on.
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
* @param {Object} message - the discordjs Message the bot is acting on.
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

/**
* Function that runs checks on an attachment from a message in the counting channel using tesseract OCR.
* @param {Object} message - The discordjs message
* @param {Object} attachment - the attachment
* @param {function} callback - The callback to call with the OCR result. The callback is passed a boolean for success or a number with the evaluated number, depending on {@link returnType}.
* @param {string} returnType - The type of the result to pass to the {@link callback} function
* @param {string} printMessage - Flag to enable/disable console.log calls, defaults to true (meaning with logging).
*/
function runChecksOCR(message, attachment, callback, returnType, printMessage = true) {
  if (printMessage) console.log('   [OCR] - running OCR...');
  tesseract
      .recognize(attachment.url, tesseractConfig)
      .then((text) => {
        if (printMessage) console.log(`   [OCR] - OUTPUT: ${text}`);
        getLastInt((prevInt) => {
          if (prevInt !== -1 && canBeParsedAsNextNumber(text, prevInt, false)) {
            if (printMessage) console.log('   [OCR] - ✔️ Image approved, it can be parsed as the next number!');
            callback(returnType === 'boolean' ? true : evaluate(text));
            return;
          }
          if (printMessage) console.log('   [OCR] - ❌ Image rejected.');
          message.author.createDM()
              .then((channel) => {
                channel.send(`*beep boop* Hi there. I couldn't quite recognize what you posted in the counting channel. I got as far as \`${text}\`! Please make sure the content in the image is very readable, my vision is not that great. Thanks!`);
              })
              .catch((error) => logger.logError(`runChecksOCR() createDM error: ${error.content}`));
          callback(returnType === 'boolean' ? false : -1);
          return;
        });
      })
      .catch((error) => {
        logger.logError('runChecksOCR() tesseract error: ' + error.message);
        callback(returnType === 'boolean' ? false : -1);
        return;
      });
}

/**
* The main checking function that runs checks on a message in the counting channel.
* @param {Object} message - The discordjs message under review.
* @param {function} callback - The callback to call with the result. It is passed a boolean that says wether the message is approved or not.
*/
function runChecks(message, callback) {
  getLastInt((prevInt) => {
    if (isDifferentMember(message)) {
      // Try parsing if the previous number is known.
      if (prevInt !== - 1 &&
                canBeParsedAsNextNumber(message.content, prevInt)) {
        callback(true);
        return;
      }

      // retry with OCR, if there is an attachment
      const pngAttachments = message.attachments.filter((attachment) => attachment.url.indexOf('png' !== -1) || attachment.url.indexOf('jpg' !== -1) || attachment.url.indexOf('jpeg' !== -1));
      if (pngAttachments.size > 0) {
        runChecksOCR(message, pngAttachments.first(), callback, 'boolean');
        return;
      }
    }
    // not different member, or no satisfied requirements
    callback(false);
    return;
  });
}

/**
* Function that handles message edits. It tries its best to ensure that the edited message is still correct,
* but it is limited in the APIs ability to edit message attachments.
* @param {Object} oldMessage - the discordjs Message before it was edited.
* @param {Object} newMessage - the discordjs Message after it was edited.
*/
function handleEdited(oldMessage, newMessage) {
  if (!isNaN(evaluate(oldMessage.content))) {
    if (evaluate(newMessage.content) !== evaluate(oldMessage.content)) {
      if (lastMessage && lastMessage.id === newMessage.id) {
      // not approved, and it's the newest message. delete it!
        newMessage.delete()
            .then((m) => {
              fetchLastMessage();
            })
            .catch((error)=>{
              logger.logError(`handleMessageInMillion() message deletion error: ${error.message}`);
            });
      } else {
        // not approved, but not the newest. Can't delete it. Send a message about it though.
        newMessage.author.createDM()
            .then((channel) => {
              channel.send(`*beep boop* Hi there. You edited a message in the counting channel. I detected that it isn't correct anymore. Please make sure the content of your message evaluates to ${evaluate(oldMessage.content)}. Have a nice day!`);
            })
            .catch((error) => logger.logError(`handleEdited() createDM error: ${error.content}`));
      }
    }
  }
}


/**
* The handler function that runs checks on a message in any other channel.
* This function handles bot commands, using {@link AVAILABLE_COMMANDS}.
* @param {Object} message - The discordjs message that's being processed.
*/
function handleMessageInOtherChannel(message) {
  // we don't care about what bots send.
  if (message.author.bot) return;
  const cmdMessage = message.content.toLowerCase();

  if (cmdMessage.indexOf('!million-') !== -1) {
    for (const key in AVAILABLE_COMMANDS) {
      if (AVAILABLE_COMMANDS.hasOwnProperty(key) &&
           cmdMessage.indexOf(key) !== -1) {
        AVAILABLE_COMMANDS[key](message);
        return;
      }
    }
    message.channel.send(`Unknown command. Available commands: ${Object.keys(AVAILABLE_COMMANDS).reduce((a, b) => `${a}, ${b}`)}`);
  }
  // if we reach this part it's a normal message, do nothing.
}

/**
* The handler function that runs checks on a message in the counting channel.
* @param {Object} message - The discordjs message that's being processed.
*/
function handleMessageInMillion(message) {
  console.log(`User ${message.author.username} sent ${message.content}`);
  // once this function is in action, the {@link lastMessage} should be initialized.
  if (lastMessage === undefined || lastMessage === null) {
    logger.logError(`handleMessageInMillion() lastMessage: ${lastMessage}. It should be initialized when this function is called.`);
    lastMessage = message;
    return;
  }

  // ok, everything looks good. Time to check the message.
  runChecks(message, (messageApproved) => {
    if (messageApproved) {
      logger.logMessage(message, true, true);
      lastMessage = message;
      addStats(message);
    } else {
      logger.logMessage(message, false, true);
      message.delete()
          .then((m) => {
            fetchLastMessage();
          })
          .catch((error)=>{
            logger.logError(`handleMessageInMillion() message deletion error: ${error.message}`);
          });
    }
  });
}

/**
* Function that returns the counting channel. It finds the channnel from either the test server or the production server based on the .env setting.
* @return {Object} the counting channel.
*/
function getMillionChannel() {
  const id = Number(process.env.PRODUCTION) > 0 ?
            Number(process.env.BETTER_CPP_SERVER_ID) :
            Number(process.env.TEST_SERVER_ID);
  return client.guilds.cache
      .find((guild) => Number(guild.id) === id)
      .channels.cache
      .find((channel) => channel.name.toLowerCase() == COUNTING_CHANNEL_NAME);
}

/**
* function that retrieves the last send message from the counting channel as a discordjs Message.
* it stores the retrieved message in the {@link lastMessage} global variable.
*/
function fetchLastMessage() {
  console.log('Fetching the last message..');
  const millionChannel = getMillionChannel();

  millionChannel.messages.fetch({limit: 2})
      .then((messages) => {
        console.log(`${messages.first().content.length > 0 ?
                 messages.first().content:
                '<empty message>'}`);
        lastMessage = messages.first();
      })
      .catch((error) => logger.logError('fetchLastMessage(): message fetch error ' + error.message));
}


// ///////////////////////////////////
// Discordjs client event handlers //
// ///////////////////////////////////

client.once('ready', () => {
  console.log('Connection successful.');
  fetchLastMessage();
});


client.on('message', (message) => {
  if (message.channel.type === 'dm') {
      return;
  }
  
  const id = Number(process.env.PRODUCTION) > 0 ?
        Number(process.env.BETTER_CPP_SERVER_ID) :
        Number(process.env.TEST_SERVER_ID);
  if (Number(message.guild.id) === id) {
    if (message.channel.name === COUNTING_CHANNEL_NAME) {
      handleMessageInMillion(message);
    } else {
      handleMessageInOtherChannel(message);
    }
  }
});

client.on('messageUpdate', (oldMessage, newMessage) => {
  if (newMessage.channel.type === 'dm') {
      return;
  }
  
  const id = Number(process.env.PRODUCTION) > 0 ?
        Number(process.env.BETTER_CPP_SERVER_ID) :
        Number(process.env.TEST_SERVER_ID);
  if (Number(newMessage.guild.id) === id) {
    if (newMessage.channel.name === COUNTING_CHANNEL_NAME) {
      console.log(`Detected a message update: User 
        ${newMessage.author.username} changed 
        ${oldMessage.content} to ${newMessage.content}.`);

      // run checks on edited messages.
      handleEdited(oldMessage, newMessage);
    }
  }
});

// ////////////////
// Main section //
// ////////////////

client.login(process.env.TOKEN);

// when the process is halted, save the userStats data first.
nodeCleanup((exitCode, signal) => {
  fs.writeFileSync('./data/userStats.json',
      JSON.stringify(userStats),
      (err) => {
        if (err) logger.logError('nodeCleanup error: ' + err.message);
        console.log('Saved user stats, exiting.');
      });
});
