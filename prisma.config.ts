import { defineConfig } from '@prisma/config';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  earlyAccess: true,
  migrate: {
    connection: {
      url: process.env.DATABASE_URL,
    },
  },
});
