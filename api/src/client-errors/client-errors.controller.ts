import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Logger } from '@nestjs/common';

type ClientErrorBody = {
  message?: string;
  url?: string;
  timestamp?: string;
} & Record<string, unknown>;

@Controller('client-errors')
export class ClientErrorsController {
  private readonly log = new Logger(ClientErrorsController.name);

  @Post()
  @HttpCode(200)
  report(@Body() body: ClientErrorBody) {
    this.log.error(`[CLIENT ERROR] ${JSON.stringify(body, null, 2)}`);
    return { success: true };
  }
}
