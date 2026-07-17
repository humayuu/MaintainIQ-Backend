import { Router } from 'express';

import {
  createAsset,
  listAssets,
  getAssetStats,
  getMaintenanceSchedule,
  getAsset,
  updateAsset,
  getAssetQr,
  getAssetLabel,
  getAssetHistory,
} from '../controllers/assetController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = Router();

// All asset routes require a valid token.
router.use(protect);

// Collection
router.post('/', authorize('admin'), createAsset); // admin only
router.get('/', listAssets); // any authenticated role

// Aggregate stats — MUST be declared before '/:id' so 'stats' isn't captured
// as an asset id.
router.get('/stats', getAssetStats); // any authenticated role

// Maintenance calendar feed — also before '/:id' so 'schedule' isn't an id.
router.get('/schedule', getMaintenanceSchedule); // any authenticated role

// Single asset
router.get('/:id', getAsset); // any authenticated role
router.put('/:id', authorize('admin'), updateAsset); // admin only

// QR + label
router.get('/:id/qr', getAssetQr); // any authenticated role
router.get('/:id/label', getAssetLabel); // any authenticated role

// History (append-only; read only — there is intentionally no PUT/DELETE)
router.get('/:id/history', getAssetHistory); // any authenticated role

export default router;
