import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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

  @Patch(':expenseId')
  update(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @Body() dto: CreateExpenseDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ExpenseResponse> {
    return this.expensesService.update(
      tripId,
      expenseId,
      request.user.id,
      dto,
    );
  }

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
