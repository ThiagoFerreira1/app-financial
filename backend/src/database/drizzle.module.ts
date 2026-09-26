import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import {
  drizzle,
  type NodePgDatabase,
  type NodePgTransaction,
} from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index.js';

export const DRIZZLE = Symbol('DRIZZLE_CLIENT');

export type DrizzleClient = NodePgDatabase<typeof schema>;
export type DrizzleExecutor =
  | DrizzleClient
  | NodePgTransaction<typeof schema, ExtractTablesWithRelations<typeof schema>>;

@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): DrizzleClient => {
        const pool = new Pool({
          connectionString: configService.get<string>('DATABASE_URL'),
        });
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule {}
