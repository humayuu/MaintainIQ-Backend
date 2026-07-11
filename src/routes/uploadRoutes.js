import { Router } from 'express';

import { uploadEvidence } from '../controllers/uploadController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadEvidenceFiles } from '../middleware/upload.js';

const router = Router();

// POST /api/uploads — authenticated evidence upload (technician/admin).
// multer parses the multipart body before the controller streams to Cloudinary.
router.post('/', protect, uploadEvidenceFiles, uploadEvidence);

export default router;
