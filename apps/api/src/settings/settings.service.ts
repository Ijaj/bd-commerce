import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type Redis from 'ioredis';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS } from '../redis/redis.module';
import {
  isSettingKey,
  SETTING_KEYS,
  SETTINGS,
  type SettingKey,
  type SettingsMap,
  type SettingValue,
} from './registry';

const CACHE_KEY = 'settings:overrides';
const CACHE_TTL_SEC = 300;

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async get<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
    return (await this.all())[key];
  }

  /** Defaults merged with stored overrides. Overrides that no longer validate fall back to the default. */
  async all(): Promise<SettingsMap> {
    const overrides = await this.overrides();
    const out: Record<string, unknown> = {};
    for (const key of SETTING_KEYS) {
      const def = SETTINGS[key];
      if (key in overrides) {
        const parsed = def.schema.safeParse(overrides[key]);
        if (parsed.success) {
          out[key] = parsed.data;
          continue;
        }
        this.logger.warn(`Stored setting ${key} is invalid; using default`);
      }
      out[key] = def.default;
    }
    return out as SettingsMap;
  }

  async listForAdmin() {
    const [values, rows] = await Promise.all([
      this.all(),
      this.prisma.setting.findMany({
        include: { updatedBy: { select: { id: true, name: true } } },
      }),
    ]);
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return SETTING_KEYS.map((key) => {
      const def = SETTINGS[key];
      const row = byKey.get(key);
      return {
        key,
        group: def.group,
        description: def.description,
        public: def.public,
        value: values[key],
        default: def.default,
        isDefault: !row,
        schema: z.toJSONSchema(def.schema, { unrepresentable: 'any' }),
        updatedAt: row?.updatedAt.toISOString() ?? null,
        updatedBy: row?.updatedBy ?? null,
      };
    });
  }

  async set(key: string, value: unknown, staffId: string) {
    const def = this.definition(key);
    const parsed = def.schema.safeParse(value);
    if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
    const json = parsed.data as Prisma.InputJsonValue;
    await this.prisma.setting.upsert({
      where: { key },
      create: { key, value: json, updatedById: staffId },
      update: { value: json, updatedById: staffId },
    });
    await this.redis.del(CACHE_KEY);
  }

  async reset(key: string) {
    this.definition(key);
    await this.prisma.setting.deleteMany({ where: { key } });
    await this.redis.del(CACHE_KEY);
  }

  private definition(key: string) {
    if (!isSettingKey(key)) throw new NotFoundException(`Unknown setting: ${key}`);
    return SETTINGS[key];
  }

  private async overrides(): Promise<Record<string, unknown>> {
    const cached = await this.redis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached) as Record<string, unknown>;
    const rows = await this.prisma.setting.findMany({ select: { key: true, value: true } });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    await this.redis.set(CACHE_KEY, JSON.stringify(map), 'EX', CACHE_TTL_SEC);
    return map;
  }
}
