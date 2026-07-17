import mongoose from 'mongoose';
import Asset from '../models/Asset.js';
import AssetHistory from '../models/AssetHistory.js';
import asyncHandler from '../utils/asyncHandler.js';
import { buildPublicAssetUrl, generateQrDataUrl } from '../utils/qr.js';
import { invalidatePublicAsset } from '../services/assetPublicService.js';

const httpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

/**
 * assignedTechnician is a User ObjectId ref. Clients sometimes send an empty
 * string (blank form field) or a populated {_id,name} object — normalize both:
 * blank/absent → leave the field unset (no crash), a populated object → its id,
 * and reject any non-empty value that is not a valid ObjectId with a clean 400
 * (a bare string like "" or "John" would otherwise throw a raw CastError 500).
 */
const normalizeAssignedTechnician = (payload) => {
  if (!('assignedTechnician' in payload)) return;
  const value = payload.assignedTechnician;
  const id = value && typeof value === 'object' ? value._id ?? value.id : value;

  if (id == null || (typeof id === 'string' && id.trim() === '')) {
    delete payload.assignedTechnician; // treat blank as "not provided"
    return;
  }
  if (!mongoose.isValidObjectId(id)) {
    throw httpError('assignedTechnician must be a valid technician id', 400);
  }
  payload.assignedTechnician = id;
};

// Fields an admin may set on create / update. publicSlug is intentionally NOT
// here — it is derived once by the model and must never be client-controlled.
const CREATABLE_FIELDS = [
  'name',
  'assetCode',
  'category',
  'location',
  'condition',
  'manufacturer',
  'model',
  'serialNumber',
  'description',
  'status',
  'assignedTechnician',
  'lastServiceDate',
  'nextServiceDate',
];

// On update we allow the same set EXCEPT publicSlug (never) — assetCode stays
// editable but, because the model only generates the slug when it's missing,
// changing the code will NOT alter the existing publicSlug.
const UPDATABLE_FIELDS = CREATABLE_FIELDS;

const pick = (source, fields) =>
  fields.reduce((acc, key) => {
    if (source[key] !== undefined) acc[key] = source[key];
    return acc;
  }, {});

/**
 * POST /api/assets  (admin only)
 * Creates an asset; publicSlug auto-generates in the model hook.
 */
export const createAsset = asyncHandler(async (req, res) => {
  const payload = pick(req.body, CREATABLE_FIELDS);
  normalizeAssignedTechnician(payload);

  // Clear, explicit duplicate check (the unique index is the ultimate guard,
  // but this gives a friendlier message than a raw duplicate-key error).
  if (payload.assetCode) {
    const existing = await Asset.findOne({ assetCode: payload.assetCode });
    if (existing) {
      throw httpError(`An asset with assetCode "${payload.assetCode}" already exists`, 409);
    }
  }

  const asset = await Asset.create(payload);
  res.status(201).json({ success: true, data: { asset } });
});

/**
 * GET /api/assets  (any authenticated role)
 * Paginated list with optional filters.
 */
export const listAssets = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;

  // Whitelist which query params become DB filters.
  const filter = {};
  for (const key of ['status', 'category', 'location', 'assignedTechnician']) {
    if (req.query[key]) filter[key] = req.query[key];
  }

  // Free-text search across the human-readable fields. Escape regex specials so
  // user input can't create an invalid or catastrophic pattern.
  if (req.query.search && req.query.search.trim()) {
    const escaped = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');
    filter.$or = [{ name: rx }, { assetCode: rx }, { category: rx }, { location: rx }];
  }

  const [assets, total] = await Promise.all([
    Asset.find(filter)
      .populate('assignedTechnician', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Asset.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      assets,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 0,
      },
    },
  });
});

/**
 * GET /api/assets/stats  (any authenticated role)
 * Fleet totals + a per-status breakdown. Computed with an aggregation so the
 * dashboard never has to fetch (and cap) the full asset list.
 */
export const getAssetStats = asyncHandler(async (req, res) => {
  const [total, grouped] = await Promise.all([
    Asset.countDocuments(),
    Asset.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const byStatus = {};
  grouped.forEach((g) => {
    if (g._id) byStatus[g._id] = g.count;
  });

  res.status(200).json({ success: true, data: { total, byStatus } });
});

/**
 * GET /api/assets/:id  (any authenticated role)
 * Full internal detail, assignedTechnician name populated.
 */
export const getAsset = asyncHandler(async (req, res) => {
  const asset = await Asset.findById(req.params.id).populate('assignedTechnician', 'name');
  if (!asset) {
    throw httpError('Asset not found', 404);
  }
  res.status(200).json({ success: true, data: { asset } });
});

/**
 * PUT /api/assets/:id  (admin only)
 * Edits an asset. publicSlug is never touched.
 */
export const updateAsset = asyncHandler(async (req, res) => {
  const asset = await Asset.findById(req.params.id);
  if (!asset) {
    throw httpError('Asset not found', 404);
  }

  const updates = pick(req.body, UPDATABLE_FIELDS);
  normalizeAssignedTechnician(updates);

  // Guard against a duplicate assetCode if it's being changed.
  if (updates.assetCode && updates.assetCode !== asset.assetCode) {
    const clash = await Asset.findOne({ assetCode: updates.assetCode, _id: { $ne: asset._id } });
    if (clash) {
      throw httpError(`An asset with assetCode "${updates.assetCode}" already exists`, 409);
    }
  }

  // publicSlug is not in UPDATABLE_FIELDS and the model only generates it when
  // missing, so it stays fixed no matter what name/location/code changes here.
  Object.assign(asset, updates);

  await asset.save(); // runs validation (incl. service-date check) via the model hook
  await asset.populate('assignedTechnician', 'name');

  // The public (QR) view of this asset is cached by slug — drop it so edits to
  // status/condition/service dates are reflected on the next scan immediately.
  invalidatePublicAsset(asset.publicSlug);

  res.status(200).json({ success: true, data: { asset } });
});

/**
 * GET /api/assets/:id/qr  (any authenticated role)
 * Returns a base64 PNG QR encoding ONLY the public URL.
 */
export const getAssetQr = asyncHandler(async (req, res) => {
  const asset = await Asset.findById(req.params.id).select('publicSlug');
  if (!asset) {
    throw httpError('Asset not found', 404);
  }

  const url = buildPublicAssetUrl(asset.publicSlug);
  const qr = await generateQrDataUrl(url); // encodes the URL and nothing else

  res.status(200).json({ success: true, data: { url, qr } });
});

/**
 * GET /api/assets/:id/label  (any authenticated role)
 * Print-ready label payload.
 */
export const getAssetLabel = asyncHandler(async (req, res) => {
  const asset = await Asset.findById(req.params.id).select('name assetCode location publicSlug');
  if (!asset) {
    throw httpError('Asset not found', 404);
  }

  const url = buildPublicAssetUrl(asset.publicSlug);
  const qr = await generateQrDataUrl(url);

  res.status(200).json({
    success: true,
    data: {
      org: 'MaintainIQ',
      assetName: asset.name,
      assetCode: asset.assetCode,
      location: asset.location,
      qr,
      scanInstruction: 'Scan this code to report an issue or view this asset.',
    },
  });
});

/**
 * GET /api/assets/:id/history  (any authenticated role)
 * Full append-only history timeline, newest first. Each entry shows the
 * timestamp, actor name (if any), action, and the related issue's number.
 */
export const getAssetHistory = asyncHandler(async (req, res) => {
  const asset = await Asset.findById(req.params.id).select('_id');
  if (!asset) {
    throw httpError('Asset not found', 404);
  }

  const entries = await AssetHistory.find({ asset: asset._id })
    .sort({ timestamp: -1 })
    .populate('actor', 'name')
    .populate('relatedIssue', 'issueNumber')
    .lean();

  const history = entries.map((e) => ({
    timestamp: e.timestamp,
    actor: e.actor?.name ?? null,
    action: e.action,
    relatedIssue: e.relatedIssue?.issueNumber ?? null,
  }));

  res.status(200).json({ success: true, data: { history } });
});
