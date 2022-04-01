import { CommandoMessage } from 'discord.js-commando';
import { LogUtil } from '../../../util';
import Command from '../../command';
import ModmailBot from '../..';

type Args = {
  name: string
}

/**
 * Utilize a standard reply anonymously for a thread
 * Requirements:
 *  * Must be used in a thread text-channel
 *  * The standard reply must exist
 */
export default class StandardReplyAnon extends Command {
  constructor(client: ModmailBot) {
    super(client, {
      description: 'Reply with a standard reply anonymously',
      group: 'standard_replies',
      memberName: 'sreplya',
      name: 'sreplya',
      aliases: ['sra', 'sar'],
      guildOnly: true,
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
    const pool = ModmailBot.getDB();
    const modmail = ModmailBot.getModmail();
    const thread = await modmail.threads.getByChannel(msg.channel.id);

    if (thread === null) {
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

    await thread.sendSR(msg, standardReply.reply, true);

    return null;
  }
}
