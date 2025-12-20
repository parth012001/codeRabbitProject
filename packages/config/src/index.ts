import { z } from 'zod';

// Environment Configuration Schema
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),

  // AI Provider Keys
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),

  // Email Provider
  EMAIL_PROVIDER: z.enum(['gmail', 'outlook', 'mock']).default('mock'),

  // Gmail OAuth
  GMAIL_CLIENT_ID: z.string().optional(),
  GMAIL_CLIENT_SECRET: z.string().optional(),
  GMAIL_REDIRECT_URI: z.string().optional(),

  // Database
  DATABASE_URL: z.string().optional(),

  // Redis (for caching/queues)
  REDIS_URL: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function loadEnvConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:', result.error.format());
    throw new Error('Invalid environment configuration');
  }

  return result.data;
}

// Application Configuration
export interface AppConfig {
  server: {
    port: number;
    env: 'development' | 'production' | 'test';
  };
  ai: {
    provider: 'openai' | 'anthropic' | 'google';
    model: string;
    maxTokens: number;
    temperature: number;
  };
  email: {
    provider: 'gmail' | 'outlook' | 'mock';
    maxBatchSize: number;
    syncIntervalMs: number;
  };
  agent: {
    maxToolCalls: number;
    timeoutMs: number;
    retryAttempts: number;
  };
}

export const defaultConfig: AppConfig = {
  server: {
    port: 3000,
    env: 'development',
  },
  ai: {
    provider: 'openai',
    model: 'gpt-4o',
    maxTokens: 4096,
    temperature: 0.7,
  },
  email: {
    provider: 'mock',
    maxBatchSize: 50,
    syncIntervalMs: 60000,
  },
  agent: {
    maxToolCalls: 10,
    timeoutMs: 30000,
    retryAttempts: 3,
  },
};

export function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    server: { ...defaultConfig.server, ...overrides.server },
    ai: { ...defaultConfig.ai, ...overrides.ai },
    email: { ...defaultConfig.email, ...overrides.email },
    agent: { ...defaultConfig.agent, ...overrides.agent },
  };
}
