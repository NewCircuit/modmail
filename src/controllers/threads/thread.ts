import {
  DMChannel, GuildMember, Message, MessageEmbed, TextChannel, User,
} from 'discord.js';
import { CommandoMessage } from 'discord.js-commando';
import {
  Attachment,
  Edit,
  Message as PartialMessage,
  Thread as PartialThread,
} from '@newcircuit/modmail-types';
import getUrls from 'get-urls';
import { Message as MMMessage, Threads } from '..';
import { CLOSE_THREAD_DELAY } from '../../globals';
import { Embeds, LogUtil } from '../../util';
import Category from '../categories/category';
import ModmailBot from '../../bot';

export default class Thread {
  private readonly modmail: ModmailBot;

  private ref: PartialThread;

  constructor(modmail: ModmailBot, ref: PartialThread) {
    this.modmail = modmail;
    this.ref = ref;
  }

  /**
   * Close this thread
   * @return {Promise<void>}
   */
  public async close(): Promise<void> {
    const pool = ModmailBot.getDB();
    const dmEmbed = Embeds.closeThreadClient();
    const threadEmbed = Embeds.closeThread();
    const dmChannel = await this.getDMChannel();
    const thChannel = await this.getThreadChannel();

    try {
      await dmChannel.send(dmEmbed);
    } finally {
      await pool.threads.close(this.ref.channel);
      if (thChannel !== null) {
        await thChannel.send(threadEmbed);
        await new Promise((r) => setTimeout(r, CLOSE_THREAD_DELAY));
        await thChannel.delete('Thread closed');
      }
    }
  }

  public getID(): string {
    return this.ref.id;
  }

  public async getAuthor(): Promise<User> {
    return this.modmail.users.fetch(
      this.ref.author.id,
      true,
    );
  }

  public async getMember(
    userID: string | null = null,
  ): Promise<GuildMember | null> {
    const category = await this.getCategory();

    if (category === null) { return null; }

    try {
      const guild = await this.modmail.guilds.fetch(
        category.getGuildID(),
        true,
      );

      return guild.member(userID || this.ref.author.id);
    } catch (_) {
      return null;
    }
  }

  public async getCategory(): Promise<Category | null> {
    return this.modmail.categories.getByID(this.ref.category);
  }

  public async getThreadChannel(): Promise<TextChannel | null> {
    try {
      const channel = await this.modmail.channels.fetch(
        this.ref.channel,
        true,
      );

      return channel.type === 'text'
        ? channel as TextChannel
        : null;
    } catch (_) {
      return null;
    }
  }

  public async getDMChannel(): Promise<DMChannel> {
    const user = await this.getAuthor();

    return user.dmChannel || user.createDM();
  }

  public async deleteLastMsg(authorID: string): Promise<void> {
    const msg = await this.getLastMessage(authorID);

    if (msg !== null) {
      await msg.delete();
    }
  }

  /**
   * Delete a message inside this thread based on an ID
   * @param  {string} id ID of the message
   * @return {Promise<void>}
   */
  public async deleteMsg(id: string): Promise<void> {
    const msg = await this.getMessage(id);

    if (msg !== null) {
      await msg.delete();
    }
  }

  public async getMessage(id: string): Promise<MMMessage | null> {
    return this.modmail.messages.getByID(id);
  }

  public async getLastMessage(authorID: string): Promise<MMMessage | null> {
    return this.modmail.messages.getLastFrom(this.ref.id, authorID);
  }

  /**
   * Send a member's message to an active thread
   * @param {Message} msg The member's message
   */
  public async recvMsg(msg: Message): Promise<void> {
    const pool = ModmailBot.getDB();
    const attCtrl = this.modmail.attachments;
    const thChannel = await this.getThreadChannel();
    const thMsgEmbed = Embeds.messageRecv(
      msg.content,
      msg.author,
      false,
    );

    if (thChannel === null) {
      throw new Error(
        `Failed to retrieve the thread channel for ${this.ref.id}`
        + ', did it get deleted?',
      );
    }

    const thMessage = await thChannel.send(thMsgEmbed);

    // Handle link warning
    const links = getUrls(msg.content);
    if (links.size > 0) {
      const embed = Embeds.linkWarning(links);
      await thChannel.send(embed);
    }

    // Modmail message
    const modmailMsg: PartialMessage = {
      clientID: msg.id,
      content: msg.content,
      edits: [],
      files: [],
      isDeleted: false,
      internal: false,
      modmailID: thMessage.id,
      sender: msg.author.id,
      threadID: this.ref.id,
    };

    await pool.messages.add(modmailMsg);
    await attCtrl.handleDM(
      new MMMessage(this.modmail, modmailMsg),
      msg.attachments.values(),
    );
    await msg.react('✅');
  }

  /**
   * Send a staff's standard reply to a thread
   * @param  {CommandoMessage} msg The staff's original message
   * @param  {string} context The standard reply name
   * @param  {boolean} anonymously Whether or not they're talking anonymously
   * @return {Promise<void>}
   */
  public async sendSR(
    msg: CommandoMessage,
    context: string,
    anonymously = false,
  ): Promise<void> {
    try {
      await this.send(context, msg.member as GuildMember, anonymously);
      await msg.delete();
    } catch (err) {
      const e = err as Error;
      let res;
      if (e.message.includes('Cannot send messages to this user')) {
        res = 'This user closed their DM\'s.';
      } else {
        res = 'An internal error occurred.';
      }
      LogUtil.cmdError(msg, e, res);
      await msg.say(res);
    }
  }

  /**
   * Send a staff's message to a thread
   * @param  {CommandoMessage} msg The staff's original message
   * @param  {boolean} anonymously Whether or not they're talking anonymously
   * @return {Promise<void>}
   */
  public async sendMsg(msg: CommandoMessage, anonymously: boolean): Promise<void> {
    const content = msg.argString || '';
    const attachments = msg.attachments.values();

    if (content.length === 0 && msg.attachments.size === 0) {
      await msg.reply('Please provide a body or attachments');
      return;
    }

    try {
      const mmMsg = await this.send(
        content,
        msg.member as GuildMember,
        anonymously,
      );
      await this.modmail.attachments.handle(mmMsg, attachments, anonymously);

      await msg.delete();
    } catch (err) {
      const e = err as Error;
      let res;
      if (e.message.includes('Cannot send messages to this user')) {
        res = 'This user closed their DM\'s.';
      } else {
        res = 'An internal error occurred.';
      }
      LogUtil.cmdError(msg, e, res);
      await msg.say(res);
    }
  }

  /**
   * Send a message to the thread (this is where all the magic happens)
   * @param  {string} content Content to send
   * @param  {GuildMember} sender The person who sent it
   * @param  {boolean} anonymously
   * @return {Promise<MMMessage>}
   */
  private async send(
    content: string,
    sender: GuildMember,
    anonymously = false,
  ): Promise<MMMessage> {
    const dmChannel = await this.getDMChannel();
    const thChannel = await this.getThreadChannel();
    const pool = ModmailBot.getDB();
    const footer = {
      text: anonymously
        ? 'Staff'
        : sender.roles.highest.name || 'Staff',
    };

    if (thChannel === null) {
      throw new Error('The thread channel doesn\'t exist anymore.');
    }

    const threadEmbed = Embeds.messageSend(content, sender, false);

    const dmEmbed = Embeds.messageSend(content, sender, anonymously);

    threadEmbed.footer = footer;
    dmEmbed.footer = footer;

    const dmMessage = await dmChannel.send(dmEmbed);
    const threadMessage = await thChannel.send(threadEmbed);

    await pool.users.create(sender.id);
    const mmMsg = {
      clientID: dmMessage.id,
      content,
      edits: [],
      files: [],
      isDeleted: false,
      internal: false,
      modmailID: threadMessage.id,
      sender: sender.id,
      threadID: this.ref.id,
    };
    await pool.messages.add(mmMsg);
    return new MMMessage(this.modmail, mmMsg);
  }

  /**
   * Forward this thread to another category
   * @param  {User} forwarder The user that forwarded it
   * @param  {boolean} isAdminOnly Whether or not they want it to be admin
   * only
   * @param  {Category} category The category we're forwarding this to
   * @return {Promise<boolean>}
   */
  public async forward(
    forwarder: User,
    isAdminOnly: boolean,
    category: Category,
  ): Promise<boolean> {
    const pool = ModmailBot.getDB();
    const author = await this.getUser();
    const channel = await Threads.setupChannel(
      author,
      category,
      isAdminOnly,
      forwarder,
      true,
    );

    if (channel === null) {
      return false;
    }

    await pool.threads.forward(this.ref.id, category.getID(), channel.id);

    const messages = await this.modmail.messages.getAll(this.ref.id);
    const users = new Map<string, User>();
    const attachments = new Map<string, Attachment[]>();
    const edits = new Map<string, Edit[]>();
    const usrTasks: Promise<User>[] = [];
    const msgTasks: Promise<Message>[] = [];
    const attTasks: Promise<Attachment[]>[] = [];
    const edtTasks: Promise<Edit[]>[] = [];

    // fetch all users for each message
    for (let i = 0; i < messages.length; i += 1) {
      const msg = messages[i];
      usrTasks.push(msg.getUser());
      edtTasks.push(msg.getEdits());
      attTasks.push(msg.getAttachments());
    }

    (await Promise.all(usrTasks)).forEach((user) => users.set(user.id, user));
    (await Promise.all(edtTasks)).forEach((msgEdits) => {
      if (msgEdits.length > 0) {
        edits.set(msgEdits[0].message, msgEdits);
      }
    });
    (await Promise.all(attTasks)).forEach((msgAtt) => {
      if (msgAtt.length > 0) {
        attachments.set(msgAtt[0].messageID, msgAtt);
      }
    });

    for (let i = 0; i < messages.length; i += 1) {
      const msg = messages[i];
      const user = users.get(msg.getSenderID());
      if (user === undefined) {
        continue;
      }
      const msgAtts = attachments.get(msg.getID());
      const msgEdits = edits.get(msg.getID());
      let embed;
      let attEmbed: MessageEmbed | null = null;

      if (msgEdits) {
        embed = this.ref.author.id === msg.getSenderID()
          ? Embeds.editsRecv(user, msgEdits)
          : Embeds.editsSend(user, msgEdits);
      } else if (msg.isInternal()) {
        embed = Embeds.internalMessage(msg.getContent(), user);
      } else {
        embed = this.ref.author.id === msg.getSenderID()
          ? Embeds.messageRecv(msg.getContent(), user, false)
          : Embeds.messageSend(msg.getContent(), user, false);
      }
      if (msgAtts) {
        msgAtts.forEach((att) => {
          attEmbed = this.ref.author.id === msg.getSenderID()
            ? Embeds.attachmentRecv(att, user, false)
            : Embeds.attachmentSend(att, user, false);
        });
      }

      const task = channel.send(embed);
      if (attEmbed !== null) {
        const attTask = channel.send(attEmbed);
        msgTasks.push(attTask);
      }
      msgTasks.push(task);
    }

    await Promise.all(msgTasks);
    return true;
  }

  public async getUser(): Promise<User> {
    return this.modmail.users.fetch(this.ref.author.id);
  }
}
