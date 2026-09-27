import { Controller, Get, UseGuards, UsePipes } from '@nestjs/common';

declare const AuthGuard: any;
declare const ValidationPipe: any;

@Controller('users')
export class UsersController {
  @Get()
  @UseGuards(AuthGuard)
  @UsePipes(ValidationPipe)
  findUsers() {
    return [];
  }
}
