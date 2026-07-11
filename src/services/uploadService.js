import { v2 as cloudinary } from 'cloudinary';

/**
 * Cloudinary media-upload service for issue / maintenance evidence.
 *
 * DESIGN: configuration is lazy and read from the environment at call time (not
 * at import time). This mirrors the AI-triage graceful-degradation pattern — the
 * rest of the API stays fully usable when Cloudinary is not configured; the
 * upload endpoints simply return a clean 503 (see uploadController).
 *
 * Credentials (CLOUDINARY_API_SECRET etc.) live only on the server and are never
 * sent to the client — the frontend uploads the raw file to our endpoint, we
 * push it to Cloudinary, and only the resulting secure URL is returned.
 */

// Cache the fact that we've already called cloudinary.config() this process.
let configured = false;

/** True only when all three Cloudinary credentials are present in the env. */
export const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );

const ensureConfigured = () => {
  if (!isCloudinaryConfigured()) {
    throw Object.assign(new Error('Cloudinary is not configured'), { statusCode: 503 });
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
};

/**
 * Upload a single in-memory file buffer to Cloudinary.
 *
 * @param {Buffer} buffer   the raw file bytes (from multer memoryStorage)
 * @param {object} [opts]
 * @param {string} [opts.folder='maintainiq/evidence']  target Cloudinary folder
 * @returns {Promise<{ url: string, publicId: string, resourceType: string }>}
 */
export const uploadBuffer = (buffer, { folder = 'maintainiq/evidence' } = {}) => {
  ensureConfigured();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      // resource_type 'auto' lets Cloudinary detect image vs video.
      { folder, resource_type: 'auto' },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
        });
      },
    );
    stream.end(buffer);
  });
};

export default { isCloudinaryConfigured, uploadBuffer };
