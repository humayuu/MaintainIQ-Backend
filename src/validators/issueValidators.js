import { z } from 'zod';

// Public issue submission (POST /api/public/assets/:slug/issues).
// Only title + description are required; the rest are optional aids that the
// AI-triage / reporter may fill in.
export const submitIssueSchema = z.object({
  title: z
    .string({ message: 'Title is required' })
    .trim()
    .min(1, 'Title is required')
    .max(140, 'Title is too long'),
  description: z
    .string({ message: 'Description is required' })
    .trim()
    .min(1, 'Please describe the issue'),
  category: z.string().trim().max(60, 'Category is too long').optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  reporterName: z.string().trim().max(80, 'Name is too long').optional(),
  reporterContact: z.string().trim().max(120, 'Contact is too long').optional(),
  evidence: z.array(z.string().url()).optional(),
  aiSuggested: z
    .object({
      title: z.boolean().optional(),
      category: z.boolean().optional(),
      priority: z.boolean().optional(),
    })
    .optional(),
});

// Step 1 of the public flow — the raw complaint sent for AI triage preview.
export const triageIssueSchema = z
  .object({
    complaint: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
  })
  .refine((data) => data.complaint || data.description, {
    message: 'Please describe the issue',
    path: ['complaint'],
  });
