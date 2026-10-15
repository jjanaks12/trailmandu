import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as mariadb from 'mariadb';

const connectionString = process.env.DATABASE_URL;

const adapter = connectionString
    ? new PrismaMariaDb(connectionString)
    : new PrismaMariaDb(
        mariadb.createPool({
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'cloud',
            database: process.env.DB_NAME || 'trailmandu_notifications',
            connectionLimit: 5,
        }) as any
    );

export const prisma = new PrismaClient({ adapter });

export default prisma;
