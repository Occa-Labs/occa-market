/*
  Express 4 does not forward errors thrown from async handlers to the error
  middleware — an unhandled rejection would crash the process. Wrap every async
  route handler with this so rejections reach the global error handler as a 500.
*/

import type { NextFunction, Request, Response } from "express";

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export const asyncHandler =
  (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
