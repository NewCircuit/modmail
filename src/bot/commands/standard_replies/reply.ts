import { CommandoMessage } from 'discord.js-commando';
import { LogUtil } from '../../../util';
import Command from '../../command';
import ModmailBot from '../..';

type Args = {
  name: string
}

/**
 * Utilize a standard reply for a thread
 * Requirements:
 *  * Must be used in a thread text-channel
 *  * The standard reply must exist
 */
export default class StandardReply extends Command {
  constructor(client: ModmailBot) {
    super(client, {
      description: 'Reply with a standard reply',
      group: 'standard_replies',
      guildOnly: true,
      memberName: 'sreply',
      name: 'sreply',
      aliases: ['sr'],
      args: [
        {
          key: 'name',
          type: 'string',
          prompt: 'What\'s the name of the standard reply?',
        },
      ],
    });
  }

  public async run(msg: CommandoMessage, args: Args): Promise<null> {
    const modmail = ModmailBot.getModmail();
    const pool = ModmailBot.getDB();
    const thread = await modmail.threads.getByChannel(msg.channel.id);

    if (thread === null || msg.guild === null) {
      const res = 'Not currently in a modmail thread';
      LogUtil.cmdWarn(msg, res);
      await msg.say(res);
      return null;
    }

    const standardReply = await pool.standardReplies.fetch(args.name);
    if (standardReply === null) {
      const res = 'Unable to locate that standard reply...';
      LogUtil.cmdWarn(msg, res);
      await msg.say(res);
      return null;
    }

    await thread.sendSR(msg, standardReply.reply, false);

    return null;
  }
}
