import asyncHandler from '../utils/asyncHandler.js';
import { isCloudinaryConfigured, uploadBuffer } from '../services/uploadService.js';

/**
 * POST /api/uploads          (protected — technician/admin maintenance evidence)
 * POST /api/public/uploads   (public, rate-limited — issue-report evidence)
 *
 * Accepts multipart/form-data with one or more `files`, pushes each to
 * Cloudinary, and returns the resulting secure URLs. The caller then stores
 * those URLs on the issue / maintenance record via the normal create endpoints.
 */
export const uploadEvidence = asyncHandler(async (req, res) => {
  // Cloudinary not configured → don't pretend; return a clean, explicit 503 so
  // the client can surface "uploads unavailable" instead of a generic failure.
  if (!isCloudinaryConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'File uploads are not configured on the server.',
      errors: null,
    });
  }

  const files = req.files || [];
  if (files.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: 'No files were provided', errors: null });
  }

  const uploaded = await Promise.all(files.map((file) => uploadBuffer(file.buffer)));

  return res.status(201).json({
    success: true,
    data: {
      urls: uploaded.map((u) => u.url),
      files: uploaded,
    },
  });
});

export default { uploadEvidence };
