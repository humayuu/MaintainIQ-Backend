import { z } from 'zod';

// Shared field rules — kept here so register/login/password stay consistent.
const email = z
  .string({ message: 'Email is required' })
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email address')
  .toLowerCase();

const password = z
  .string({ message: 'Password is required' })
  .min(8, 'Password must be at least 8 characters');

export const registerSchema = z.object({
  name: z
    .string({ message: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name is too long'),
  email,
  password,
  role: z.enum(['admin', 'technician', 'supervisor'], {
    message: 'Select a valid role',
  }),
});

export const loginSchema = z.object({
  email,
  // On login we only need presence — never leak the strength rule here.
  password: z.string({ message: 'Password is required' }).min(1, 'Password is required'),
});

export const verifyEmailSchema = z.object({
  token: z.string({ message: 'Verification token is required' }).min(1, 'Verification token is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z
    .string({ message: 'Current password is required' })
    .min(1, 'Current password is required'),
  newPassword: password,
});
