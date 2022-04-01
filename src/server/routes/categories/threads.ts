import { Response, Router } from 'express';
import { RoleLevel, Thread } from '@newcircuit/modmail-types';
import { RequestWithCategory } from '../../types';
import ModmailServer from '../..';
import Route from '../../route';

export default class ThreadsRoute extends Route {
  constructor(mm: ModmailServer) {
    const router = Router();
    super(mm, 'threads', router);
  }

  /**
   * GET /api/categories/:categoryID/threads/:threadID
   * @param {RequestWithUser} req
   * @param {Response} res
   * @returns {Promise<void>}
   */
  public async getThread(
    req: RequestWithCategory,
    res: Response,
  ): Promise<void> {
    const { category } = req.session;
    const { member } = req.session;
    const { threadID } = req.params;
    if (member === undefined || category === undefined || category === null) {
      res.status(401);
      res.end();
      return;
    }

    const db = this.modmail.getDB();
    const thread = await db.threads.getByID(threadID);

    if (thread === null) {
      res.status(404);
      res.end();
      return;
    }

    if (thread.isAdminOnly && member.role !== RoleLevel.Admin) {
      this.failBadReq(res, 'Not an admin');
      return;
    }

    thread.messages = await db.messages.fetchAll(threadID);

    // get user cache
    const targets = new Set<string>();

    for (let i = 0; i < thread.messages.length; i += 1) {
      const msg = thread.messages[i];

      targets.add(msg.sender);
    }

    const users = await this.modmail.getUserCache(targets.values());

    res.json({
      ...thread,
      users,
    });
    res.end();
  }

  /**
   * GET /api/categories/:categoryID/threads
   * @param {RequestWithUser} req
   * @param {Response} res
   * @returns {Promise<void>}
   */
  public async getThreads(
    req: RequestWithCategory,
    res: Response,
  ): Promise<void> {
    const { category } = req.session;
    const { member } = req.session;
    if (category === undefined || member === undefined) {
      res.status(401);
      res.end();
      return;
    }

    const db = this.modmail.getDB();

    let threads = await db.threads.getByCategory(category.id);
    threads = threads.filter((thr: Thread) => (thr.isAdminOnly && member.role === RoleLevel.Admin)
        || (!thr.isAdminOnly));
    threads = await this.modmail.getLastMessages(threads);
    const targets = new Set<string>();

    // get user cache
    for (let i = 0; i < threads.length; i += 1) {
      const thread = threads[i];
      targets.add(thread.author.id);

      // get last message author
      if (thread.messages.length > 0) {
        const message = thread.messages[0];
        targets.add(message.sender);
      }
    }

    const users = await this.modmail.getUserCache(targets.values());

    res.json({
      threads,
      users,
    });
    res.end();
  }
}
