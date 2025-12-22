import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

// ============================================================================
// Environment Validation
// ============================================================================

const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL;

if (!NEON_DATABASE_URL) {
  throw new Error('NEON_DATABASE_URL environment variable is required');
}

// ============================================================================
// Database Client
// ============================================================================

/**
 * Neon serverless SQL client
 * Uses HTTP for serverless-friendly connections
 */
const sql = neon(NEON_DATABASE_URL);

/**
 * Drizzle ORM database instance
 * Configured with schema for type-safe queries
 */
export const db = drizzle(sql, { schema });

// ============================================================================
// Health Check
// ============================================================================

/**
 * Check if the database connection is healthy
 * @returns true if database is accessible, false otherwise
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error('[Database] Health check failed:', error);
    return false;
  }
}

// Export schema for use in other modules
export * from './schema.js';
