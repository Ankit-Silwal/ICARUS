import type { Request, Response } from "express";

export class UserController {
  me(request: Request, response: Response) {
    response.json({ user: request.identity });
  }
}

export const userController = new UserController();
