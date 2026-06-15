import { All, Controller, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth';
import { Public } from './decorators/public.decorator';

/**
 * Mounts the better-auth handler at /api/auth/*. These routes are public (the
 * global AuthGuard is bypassed) and receive the raw, unparsed request because
 * main.ts skips the body parser for this path.
 */
@ApiExcludeController()
@Controller('api/auth')
export class AuthController {
  private readonly handler = toNodeHandler(auth);

  @Public()
  @All('*path')
  handle(@Req() req: Request, @Res() res: Response): void {
    void this.handler(req, res);
  }
}
