import { Message } from 'discord.js';
import { CommandoMessage } from 'discord.js-commando';
import { RoleLevel } from '../../models/types';
import Modmail from '../../Modmail';
import Command from '../../models/command';
import { Requires } from '../../util/Perms';

type CatArgs = {
  id: string;
}

export default class RemoveCategory extends Command {
  constructor(client: Modmail) {
    super(client, {
      name: 'remcat',
      aliases: ['remcat', 'rc', 'rm'],
      description: 'Remove a category',
      group: 'category',
      memberName: 'remcat',
      args: [
        {
          key: 'id',
          prompt: 'The category ID to remove',
          type: 'string',
        },
      ],
    });
  }

  @Requires(RoleLevel.Admin)
  public async run(msg: CommandoMessage, args: CatArgs): Promise<Message | Message[] | null> {
    const pool = await this.client.getDB();
    const { id } = args;

    try {
      await pool.categories.setActive(id, false);
      return msg.say('Disabled category.');
    } catch (err) {
      this.logError(msg, err);
      return msg.say(`Couldn't find category "${id}"`);
    }
  }
}
