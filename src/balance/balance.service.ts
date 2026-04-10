import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Balance } from "./balance.entity";
import {
  BalanceItemDto,
  EmployeeBalancesResponseDto,
} from "./dto/balance-response.dto";

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(Balance)
    private readonly balanceRepo: Repository<Balance>,
  ) {}

  async getByEmployee(employeeId: string): Promise<EmployeeBalancesResponseDto> {
    const balances = await this.balanceRepo.find({ where: { employeeId } });

    if (balances.length === 0) {
      throw new NotFoundException(`No balances found for employee ${employeeId}`);
    }

    return {
      employeeId,
      balances: balances.map((b) => this.toDto(b)),
    };
  }

  async getByEmployeeAndLocation(
    employeeId: string,
    locationId: string,
  ): Promise<EmployeeBalancesResponseDto> {
    const balances = await this.balanceRepo.find({
      where: { employeeId, locationId },
    });

    if (balances.length === 0) {
      throw new NotFoundException(
        `No balances found for employee ${employeeId} at location ${locationId}`,
      );
    }

    return {
      employeeId,
      balances: balances.map((b) => this.toDto(b)),
    };
  }

  async findOne(
    employeeId: string,
    locationId: string,
    policyType: string,
  ): Promise<Balance | null> {
    return this.balanceRepo.findOne({
      where: { employeeId, locationId, policyType },
    });
  }

  async holdPending(balance: Balance, days: number): Promise<Balance> {
    balance.pending = Number(balance.pending) + days;
    return this.balanceRepo.save(balance);
  }

  async releasePending(balance: Balance, days: number): Promise<Balance> {
    balance.pending = Math.max(0, Number(balance.pending) - days);
    return this.balanceRepo.save(balance);
  }

  async deductUsed(balance: Balance, days: number): Promise<Balance> {
    balance.pending = Math.max(0, Number(balance.pending) - days);
    balance.used = Number(balance.used) + days;
    return this.balanceRepo.save(balance);
  }

  async restoreUsed(balance: Balance, days: number): Promise<Balance> {
    balance.used = Math.max(0, Number(balance.used) - days);
    return this.balanceRepo.save(balance);
  }

  async upsert(
    employeeId: string,
    locationId: string,
    policyType: string,
    available: number,
    used: number,
  ): Promise<Balance> {
    let balance = await this.findOne(employeeId, locationId, policyType);

    if (balance) {
      balance.available = available;
      balance.used = used;
      balance.lastSyncedAt = new Date();
      return this.balanceRepo.save(balance);
    }

    balance = this.balanceRepo.create({
      employeeId,
      locationId,
      policyType,
      available,
      used,
      pending: 0,
      lastSyncedAt: new Date(),
    });
    return this.balanceRepo.save(balance);
  }

  private toDto(balance: Balance): BalanceItemDto {
    return {
      locationId: balance.locationId,
      policyType: balance.policyType,
      available: Number(balance.available),
      used: Number(balance.used),
      pending: Number(balance.pending),
      effectiveAvailable: balance.effectiveAvailable,
      lastSyncedAt: balance.lastSyncedAt?.toISOString() ?? null,
    };
  }
}
