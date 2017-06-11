const util = require('util');
const jsonQuery = require('json-query');
const titlecase = require('titlecase');
const escapeStringRegexp = require('escape-string-regexp');

const fs = require('fs');
const path = require('path');
const botUtils = require(path.join(__dirname, 'common-bot-utils.js'));

const enlirJsonPath = path.join(__dirname, '..', 'enlir_json');
const enlirSoulbreaksPath = path.join(enlirJsonPath, 'soulbreaks.json');
const enlirBsbCommandsPath = path.join(enlirJsonPath, 'bsbCommands.json');
const aliasesPath = path.join(__dirname, 'aliases.json');

const enlirSoulbreaksFile = fs.readFileSync(enlirSoulbreaksPath);
const enlirBsbCommandsFile = fs.readFileSync(enlirBsbCommandsPath);
const aliasesFile = fs.readFileSync(aliasesPath);

const enlirSoulbreaks = JSON.parse(enlirSoulbreaksFile);
const enlirBsbCommands = JSON.parse(enlirBsbCommandsFile);
const aliases = JSON.parse(aliasesFile);

/** searchSoulbreak:
 * Searches and returns the soul breaks for a given character.
 * @param {string} character: the name of the character to search.
 * @param {string} sbType: The type of soul break to look up
 *  (one of: all, default, sb, bsb, usb, osb). Defaults to 'all'.)
 * @return {object} Promise: a Promise with a result if resolved.
 **/
function searchSoulbreak(character, sbType='all') {
  console.log(`Character to lookup: ${character}`);
  console.log(`Soul break to return: ${sbType}`);
  character = escapeStringRegexp(character);
  let characterQueryString = util.format('[*character~/^%s$/i]', character);
  console.log(`characterQueryString: ${characterQueryString}`);
  return new Promise( (resolve, reject) => {
    try {
      let result;
      result = jsonQuery(characterQueryString, {
        data: enlirSoulbreaks,
        allowRegexp: true,
      });
      if (result.value === null) {
        console.log('No results found.');
        resolve(result);
      };
      if (sbType.toLowerCase() !== 'all') {
        let dataset = result.value;
        sbType = escapeStringRegexp(sbType);
        let tierQueryString = util.format('[*tier~/^%s$/i]', sbType);
        console.log(`tierQueryString: ${tierQueryString}`);
        result = jsonQuery(tierQueryString, {
          data: dataset,
          allowRegexp: true,
        });
      };
      console.log(`Returning results: ${result.value.length}`);
      resolve(result);
    } catch (error) {
      console.log(`Error in searchSoulbreak: ${error}`);
      reject(error);
    };
  });
};

/** checkSoulbreakFilter:
 *  Checks the soulbreak filter to see if it is a valid soulbreak type.
 *  @param {String} sbType: The soulbreak filter to check.
 *  @return {Boolean}: Valid or invalid soulbreak.
 **/
function checkSoulbreakFilter(sbType) {
  let possibleSbTypes = ['all', 'default', 'sb', 'ssb',
    'bsb', 'usb', 'osb', 'csb'];
  if (possibleSbTypes.indexOf(sbType.toLowerCase()) === -1) {
    return false;
  } else {
    return true;
  };
};

/** lookupSoulbreak:
 *  Runs searchSoulbreak to find a soul break for a given character.
 *  @param {Object} msg: A message object from the Discord.js bot.
 *  @param {String} character: the name of the character to search.
 *  @param {String} sbType: the type of soul break to search.
 *    (one of: all, default, sb, bsb, usb, osb). Defaults to 'all'.)
 **/
exports.soulbreak = function lookupSoulbreak(msg, character, sbType) {
  console.log(util.format(',sb caller: %s#%s',
    msg.author.username, msg.author.discriminator));
  console.log(`Lookup called: ${character} ${sbType}`);
  if (character.length < 3) {
    msg.channel.send(
      'Character name must be at least three characters.');
    return;
  };
  if (checkSoulbreakFilter(sbType) === false) {
    msg.channel.send(
      'Soulbreak type not one of: All, Default, SB, SSB, BSB, USB, OSB, CSB.');
    return;
  };
  console.log(`Alias check: ${checkAlias(character)}`);
  if (checkAlias(character) != null) {
    character = checkAlias(character);
  };
  let sbQueryResults = searchSoulbreak(character, sbType);
  sbQueryResults.then( (resolve) => {
    console.log(`calling sbQueryResults.`);
    character = titlecase.toLaxTitleCase(character);
    if (resolve.value.length === 0) {
      msg.channel.send(`No results for '${character}' '${sbType}'.`);
      return;
    };
    let dm = false;
    if (resolve.value.length > 5) {
      msg.reply(`${character} has like` +
        ` ${resolve.value.length} soulbreaks and I don't wanna spam` +
        ` the channel with more than 5 soulbreaks at a time.` +
        ` I'm going to DM you this info; if you want me to send it here, ` +
        ` filter by Default/SB/SSB/BSB/USB/OSB/CSB.`);
      dm = true;
    };
    resolve.value.forEach( (value) => {
      processSoulbreak(value, msg, dm, character, sbType);
    });
  return;
  });
};

/** checkAlias:
 * Checks to see if an alias belongs to a character.
 * @param {String} alias: The alias to check.
 * @return {String} character: the character's name, or
 * @return {null} null: if no result found.
 **/
function checkAlias(alias) {
  if (alias.toLowerCase() in aliases) {
    return aliases[alias.toLowerCase()];
  } else {
    return null;
  };
};
/** checkBsb:
 * Checks to see if a given SB is a BSB.
 * @param {Dict} sb: The soulbreak to check.
 * @return {Boolean}: true if it's a BSB, false if not.
 **/
function checkBsb(sb) {
  console.log(`Checking if ${sb.name} is a BSB`);
  let result = (sb.tier.toUpperCase() === 'BSB') ? (true) : (false);
  return result;
};

/** searchBsbCommands:
 * Searches Enlir's BSB database for BSB commands by name.
 * @param {string} sb: The SB name to search.
 * @return {object} Promise: results of search if resolved.
 **/
function searchBsbCommands(sb) {
  let bsbQuery = util.format('[*source=%s]', sb);
  return new Promise( (resolve, reject) => {
    try {
      let results = jsonQuery(bsbQuery, {
        data: enlirBsbCommands,
      });
      console.log(`bsbQuery results: ${results.value.length}`);
      resolve(results);
    } catch (error) {
      console.log(`bsbQuery failed, reason: ${error}`);
      reject(error);
    }
  });
};

/** processSoulbreak:
 * Takes JSON about a soulbreak and outputs info in plaintext.
 * @param {object} soulbreak: a JSON dict returned from searchSoulbreak.
 * @param {object} msg: a discord.js-commando Message object.
 * @param {boolean} dm: Whether to DM the user the information.
 * @param {string} character: the character to search.
 * @param {string} sbType: The soulbreak filter to use.
 **/
function processSoulbreak(soulbreak, msg, dm=false, character, sbType='all') {
  console.log(`dm: ${dm}`);
  let element = botUtils.returnElement(soulbreak);
  let pad = 22;
  let skillType = soulbreak.type;
  let target = soulbreak.target;
  let castTime = soulbreak.time;
  let multiplier = botUtils.returnMultiplier(soulbreak);
  let sbTier = soulbreak.tier;
  let typeMsg = botUtils.returnPropertyString(
    skillType, 'Type', pad);
  let elementMsg = botUtils.returnPropertyString(element, 'Element');
  let targetMsg = botUtils.returnPropertyString(
    target, 'Target', pad);
  let multiplierMsg = botUtils.returnPropertyString(
    multiplier, 'Multiplier');
  let castMsg = botUtils.returnPropertyString(
    castTime, 'Cast Time', pad);
  let sbMsg = botUtils.returnPropertyString(sbTier, 'Soul Break Type');
  // remove sbMsg from castAndSbMsg if sbType is anything except 'all'
  let castAndSbMsg;
  if (sbType.toLowerCase() !== 'all') {
    castAndSbMsg = util.format('%s\n', castMsg);
  } else {
    castAndSbMsg = util.format('%s || %s\n', castMsg, sbMsg);
  };
  let description = botUtils.returnDescription(soulbreak);
  let message = (
    '**```\n' +
    util.format('%s: %s\n', character, soulbreak.name) +
    util.format('%s\n', description) +
    util.format('%s || %s\n', typeMsg, elementMsg) +
    util.format('%s || %s\n', targetMsg, multiplierMsg) +
    castAndSbMsg
    );
  // Append BSB commands if the command is a BSB
  if (checkBsb(soulbreak) === true) {
    console.log(`${soulbreak.name} is a burst soulbreak.`);
    message = message + 'BURST COMMANDS:\n';
    if (sbType.toLowerCase() === 'all') {
      message = message + '(Filter by BSB to see command details)\n';
    };
    // Let me tell you, I'm learning a lot about ES2015 Promises.
    let bsbQueryResults = searchBsbCommands(soulbreak.name);
    bsbQueryResults.then( (bsbCommandResults) => {
      bsbCommandResults.value.forEach( (bsbCommand) => {
        message = processBsb(bsbCommand, message, sbType);
        console.log(`message: ${message}`);
      });
      message = message + '```**';
      if (dm === true) {
        console.log(`msg.author: ${msg.author}`);
        msg.author.send(message);
      } else {
        msg.channel.send(message);
      };
    }).catch( (reject) => {
      console.log(`Error in bsbQueryResults: ${reject}`);
    });
  } else {
    message = message + '```**';
    if (dm === true) {
      console.log(`msg.author: ${msg.author}`);
      msg.author.send(message);
    } else {
      msg.channel.send(message);
    };
  };
};

/** processBsb:
 * Takes a BSB command and outputs a message block for it.
 * @param {object} bsbCommand: a JSON dict for a BSB command.
 * @param {string} message: Passed from processSoulbreak, the
 *  current version of the message with entry effects and
 *  SB attributes.
 * @param {string} sbType: the soul break filter.
 * @return {string} message: the complete message including
 *  the attributes for the soul break commands.
 **/
function processBsb(bsbCommand, message=null, sbType='all') {
  let command = bsbCommand.name;
  console.log(`Command ${command} found.`);
  let target = bsbCommand.target;
  let description = botUtils.returnDescription(bsbCommand);
  let element = botUtils.returnElement(bsbCommand);
  let castTime = bsbCommand.time;
  let sbCharge = bsbCommand.sb;
  let type = bsbCommand.school;
  let multiplier = botUtils.returnMultiplier(bsbCommand);
  let pad = 21;
  let targetMsg = botUtils.returnPropertyString(
    target, 'Target', pad);
  let typeMsg = botUtils.returnPropertyString(type, 'Type', pad);
  let elementMsg = botUtils.returnPropertyString(element, 'Element');
  let castMsg = botUtils.returnPropertyString(
    castTime, 'Cast Time', pad);
  let sbMsg = botUtils.returnPropertyString(
    sbCharge, 'Soul Break Charge');
  let multiplierMsg = botUtils.returnPropertyString(
    multiplier, 'Multiplier');
  message = (
    message +
    util.format('*%s (%s)\n', command, description)
    );
  if (sbType.toUpperCase() === 'BSB') {
    message = (
      message +
      util.format('-%s || %s\n', typeMsg, elementMsg) +
      util.format('-%s || %s\n', targetMsg, multiplierMsg) +
      util.format('-%s || %s\n\n', castMsg, sbMsg)
    );
  };
  console.log(`message: ${message}`);
  return message;
};
