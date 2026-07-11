import multer from 'multer';

/**
 * Multer middleware for evidence uploads.
 *
 * Uses in-memory storage so the file buffer can be streamed straight to
 * Cloudinary (uploadService) without ever touching the server's disk. Accepts
 * images and videos only, caps size, and limits how many files land per request.
 */

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB per file
const MAX_FILES = 5;

const fileFilter = (req, file, cb) => {
  if (/^(image|video)\//.test(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(Object.assign(new Error('Only image and video files are allowed'), { statusCode: 400 }));
};

// Field name is `files`; the client appends each selected file under it.
export const uploadEvidenceFiles = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter,
}).array('files', MAX_FILES);

export default uploadEvidenceFiles;
