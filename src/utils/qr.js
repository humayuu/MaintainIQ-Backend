import QRCode from 'qrcode';

/**
 * Build the public-facing URL for an asset from its slug. This is the ONLY
 * thing we ever encode into a QR code — never internal IDs, cost, or notes.
 */
export const buildPublicAssetUrl = (publicSlug) => {
  const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/asset/${publicSlug}`;
};

/**
 * Generate a QR code as a base64 PNG data URL (data:image/png;base64,...)
 * for the given text.
 */
export const generateQrDataUrl = (text) =>
  QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 1, width: 300 });
