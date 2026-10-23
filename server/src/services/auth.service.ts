import { db } from '../db';
import { User } from '@shared';

export class AuthService {


  /**
   * Log out a user by incrementing their token_version in the database,
   * immediately invalidating all active sessions.
   */
  public async logout(userId: string): Promise<void> {
    const pool = db.getPool();
    if (!pool) return;

    await pool.query('UPDATE users SET token_version = token_version + 1, updated_at = NOW() WHERE id = $1', [userId]);
  }

  /**
   * Validates a session from a decoded JWT payload against live DB record.
   */
  public async validateSession(userId: string, tokenVersion: number): Promise<User | null> {
    const pool = db.getPool();
    if (!pool) return null;

    const { rows } = await pool.query<User & { token_version: number; is_active: boolean }>(
      `SELECT id, phone, email, student_id as "studentId", role, full_name as "fullName", preferred_language as "preferredLanguage", 
              is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt", token_version
       FROM users WHERE id = $1`,
      [userId]
    );

    if (rows.length === 0) return null;

    const user = rows[0];
    if (!user.isActive || user.token_version !== tokenVersion) {
      return null;
    }

    return user;
  }
}

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    public readonly messageEn: string,
    public readonly messageHi: string,
    public readonly statusCode: number = 400
  ) {
    super(messageEn);
    this.name = 'AuthError';
  }
}
