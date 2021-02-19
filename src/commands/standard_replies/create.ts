import { RoleLevel } from '@Floor-Gang/modmail-types';
import { CommandoMessage } from 'discord.js-commando';
import Command from '../../models/command';
import Modmail from '../../Modmail';
import { CONFIG } from '../../globals';
import { Requires } from '../../util/Perms';
import LogUtil from '../../util/Logging';

type Args = {
  name: string,
  reply: string
}

export default class StandardReplyCreate extends Command {
  constructor(client: Modmail) {
    super(client, {
      description: 'create a standard reply',
      group: 'standard_replies',
      aliases: ['sradd'],
      memberName: 'srcreate',
      guildOnly: true,
      name: 'srcreate',
      args: [
        {
          key: 'name',
          type: 'string',
          prompt: 'What\'s the name of this standard reply?',
        },
        {
          key: 'reply',
          type: 'string',
          prompt: 'What\'s the actual reply message?',
        },
      ],
    });
  }

  @Requires(RoleLevel.Mod)
  public async run(msg: CommandoMessage, args: Args): Promise<null> {
    const pool = Modmail.getDB();

    try {
      await pool.standardReplies.create(args.name, args.reply);
      await msg.say(
        'Successfully created a new standard reply'
        + `\n - Usage: \`${CONFIG.bot.prefix}sr ${args.name}\``,
      );
    } catch (err) {
      let res;
      if (err.message.includes('standard_replies_name_uindex')) {
        res = 'That standard reply name already is taken.';
      } else {
        res = 'An internal issue occurred.';
      }
      LogUtil.cmdError(msg, err, res);
      await msg.say(res);
    }

    return null;
  }
}
