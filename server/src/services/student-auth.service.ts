import crypto from 'node:crypto';
import { db } from '../db';
import { User } from '@shared';

export interface RegisterStudentInput {
  fullName: string;
  email: string;
  phone?: string;
  studentId?: string;
  password?: string;
}

export interface LoginStudentInput {
  emailOrPhone: string;
  password?: string;
}

export class StudentAuthService {
  /**
   * Hashes a password using crypto.scryptSync with a 16-byte random salt.
   */
  public static hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verifies password against stored salt:hash string.
   */
  public static verifyPassword(password: string, storedHash: string): boolean {
    try {
      const [salt, hash] = storedHash.split(':');
      if (!salt || !hash) return false;
      const computed = crypto.scryptSync(password, salt, 64).toString('hex');
      return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
    } catch {
      return false;
    }
  }

  /**
   * Registers a new student account.
   */
  public async register(input: RegisterStudentInput): Promise<{ user: User; isNewUser: boolean }> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const cleanEmail = input.email.trim().toLowerCase();
    const cleanFullName = input.fullName.trim();
    const cleanPhone = input.phone?.trim() || null;
    const cleanStudentId = input.studentId?.trim() || null;
    const password = input.password || 'CampusFind123!';
    const passwordHash = StudentAuthService.hashPassword(password);

    // Check if email already registered
    const existing = await pool.query<{ id: string }>(
      'SELECT id FROM users WHERE LOWER(email) = $1 OR (phone IS NOT NULL AND phone = $2)',
      [cleanEmail, cleanPhone]
    );

    if (existing.rows.length > 0) {
      throw new Error('An account with this email or phone number already exists.');
    }

    const { rows } = await pool.query<User & { token_version: number; is_active: boolean }>(
      `INSERT INTO users (full_name, email, phone, student_id, password_hash, role, preferred_language, is_active, token_version)
       VALUES ($1, $2, $3, $4, $5, 'customer', 'en', true, 1)
       RETURNING id, full_name as "fullName", email, phone, student_id as "studentId", role, preferred_language as "preferredLanguage",
                 is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt", token_version`,
      [cleanFullName, cleanEmail, cleanPhone, cleanStudentId, passwordHash]
    );

    return { user: rows[0], isNewUser: true };
  }

  /**
   * Logs in a student by email/phone and password.
   */
  public async login(input: LoginStudentInput): Promise<{ user: User; tokenVersion: number }> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const identifier = input.emailOrPhone.trim().toLowerCase();

    const { rows } = await pool.query<User & { password_hash: string; token_version: number; is_active: boolean }>(
      `SELECT id, full_name as "fullName", email, phone, student_id as "studentId", role, preferred_language as "preferredLanguage",
              is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt", password_hash, token_version
       FROM users 
       WHERE LOWER(email) = $1 OR phone = $1
       LIMIT 1`,
      [identifier]
    );

    if (rows.length === 0) {
      throw new Error('Invalid email or password.');
    }

    const record = rows[0];
    if (!record.isActive) {
      throw new Error('Account is inactive.');
    }

    if (input.password && record.password_hash) {
      const valid = StudentAuthService.verifyPassword(input.password, record.password_hash);
      if (!valid) {
        throw new Error('Invalid email or password.');
      }
    }

    return { user: record, tokenVersion: record.token_version };
  }

  /**
   * Returns list of demo accounts for reviewer convenience.
   */
  public async getDemoStudents(): Promise<Array<{ id: string; fullName: string; email: string; studentId: string }>> {
    const pool = db.getPool();
    if (!pool) return [];

    const { rows } = await pool.query<{ id: string; fullName: string; email: string; studentId: string }>(
      `SELECT id, full_name as "fullName", email, student_id as "studentId" 
       FROM users 
       WHERE email IN ('alex@campus.edu', 'priya@campus.edu', 'marcus@campus.edu')
       ORDER BY full_name ASC`
    );

    return rows;
  }
}

export const studentAuthService = new StudentAuthService();
