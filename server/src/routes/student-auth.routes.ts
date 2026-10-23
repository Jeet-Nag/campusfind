import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { studentAuthService } from '../services/student-auth.service';
import { authenticate } from '../middleware/auth';
import { ApiResponse, User } from '@shared';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  studentId: z.string().max(50).optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});

const loginSchema = z.object({
  emailOrPhone: z.string().min(3, 'Email or phone is required'),
  password: z.string().min(1, 'Password is required'),
});

export const studentAuthRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * POST /api/auth/register
   * Registers a new student account.
   */
  app.post('/register', async (request, reply) => {
    try {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            messageEn: parsed.error.errors[0]?.message || 'Invalid registration data',
            messageHi: 'अमान्य पंजीकरण विवरण।',
          },
        };
        return reply.status(400).send(response);
      }

      const { user, isNewUser } = await studentAuthService.register(parsed.data);

      const token = app.jwt.sign(
        {
          id: user.id,
          phone: user.phone || '',
          role: user.role,
          tokenVersion: (user as any).token_version || 1,
        },
        { expiresIn: '30d' }
      );

      const response: ApiResponse<{ token: string; user: User; isNewUser: boolean }> = {
        success: true,
        data: { token, user, isNewUser },
      };
      return reply.status(201).send(response);
    } catch (err: any) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          messageEn: err.message || 'Registration failed. Please try again.',
          messageHi: 'पंजीकरण विफल रहा। कृपया पुनः प्रयास करें।',
        },
      };
      return reply.status(400).send(response);
    }
  });

  /**
   * POST /api/auth/login
   * Standard student login via email/phone and password.
   */
  app.post('/login', async (request, reply) => {
    try {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            messageEn: parsed.error.errors[0]?.message || 'Invalid login credentials',
            messageHi: 'अमान्य लॉगिन विवरण।',
          },
        };
        return reply.status(400).send(response);
      }

      const { user, tokenVersion } = await studentAuthService.login(parsed.data);

      const token = app.jwt.sign(
        {
          id: user.id,
          phone: user.phone || '',
          role: user.role,
          tokenVersion,
        },
        { expiresIn: '30d' }
      );

      const response: ApiResponse<{ token: string; user: User }> = {
        success: true,
        data: { token, user },
      };
      return reply.status(200).send(response);
    } catch (err: any) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          messageEn: err.message || 'Invalid email or password.',
          messageHi: 'अमान्य ईमेल या पासवर्ड।',
        },
      };
      return reply.status(401).send(response);
    }
  });

  /**
   * GET /api/auth/demo-students
   * Provides quick-fill demo student identities for fast reviewer verification.
   */
  app.get('/demo-students', async (_request, reply) => {
    const students = await studentAuthService.getDemoStudents();
    const response: ApiResponse<typeof students> = {
      success: true,
      data: students,
    };
    return reply.status(200).send(response);
  });
};
