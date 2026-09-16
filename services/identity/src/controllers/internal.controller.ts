import type { Request, Response } from "express";
import { z } from "zod";
import { userService } from "../services/user.service.js";

const resolveUsersSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export class InternalController {
  async resolveUsers(request: Request, response: Response) {
    const { ids } = resolveUsersSchema.parse(request.body);
    response.json({ users: await userService.resolveByIds(ids) });
  }
}

export const internalController = new InternalController();
