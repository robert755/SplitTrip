import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AccessTokenGuard } from '../auth/guards/access-token.guard.js';
import { CreateExpenseDto } from './dto/create-expense.dto.js';
import { ExpensesService, type ExpenseResponse } from './expenses.service.js';

@Controller('trips/:tripId/expenses')
@UseGuards(AccessTokenGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Body() dto: CreateExpenseDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ExpenseResponse> {
    return this.expensesService.create(tripId, request.user.id, dto);
  }

  @Get()
  findAll(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ExpenseResponse[]> {
    return this.expensesService.findAll(tripId, request.user.id);
  }
}
