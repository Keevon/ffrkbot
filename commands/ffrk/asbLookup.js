const { Command } = require("discord.js-commando");
const path = require("path");
botPath = path.join(
  __dirname,
  "..",
  "..",
  "utilities",
  "soulbreak-bot-utils.js"
);
const botUtils = require(botPath);

module.exports = class ReplyCommand extends Command {
  /** constructors a basic ability lookup.
   * @param {Object} client: discord.js-commando client.
   **/
  constructor(client) {
    super(client, {
      name: "aosb",
      group: "ffrk",
      memberName: "aosb",
      description: "Looks up arcane overstrikes for a given character.",
      examples: ["aosb Squall", "aosb Zell 1", "aosb 'onion knight' 2"],
      args: [
        {
          key: "characterName",
          prompt: "Enter the name of the character you wish to look up.",
          type: "string"
        },
        {
          key: "aosbNumber",
          prompt:
            "Enter the aosb number of the character" +
            " you wish to look up. (Optional.)",
          type: "integer",
          default: ""
        }
      ],
      aliases: ["uosb", "ao", "arcane"]
    });
  }

  /** trigger to run upon invocation.
   * @param {Object} msg: discord.js-commando message.
   * @param {Array} args: args from the user input.
   * @return {Method} msg.say: string
   **/
  run(msg, args) {
    const { characterName, asbNumber } = args;
    return botUtils
      .soulbreak(msg, characterName, "aosb", asbNumber)
      .catch(err => {
        console.log(`Error calling asbLookup: ${err}`);
      });
  }
};
