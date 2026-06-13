const { Product, ProductVariant, Vendor, Category } = require('../models');
const { paginate, paginateResponse } = require('../utils/helpers');
const { Op } = require('sequelize');

const TRUE_VALUES = ['true', '1', 1, true];
const toBool = (v) => TRUE_VALUES.includes(v);
const toArray = (v) => {
  if (Array.isArray(v)) return v;
  if (v === undefined || v === null || v === '') return [];
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) { /* not JSON, fall through to comma-split */ }
    return v.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
};

// Normalize a multipart/form-data or JSON body into clean Product fields.
const buildProductData = (body) => {
  const data = { ...body };
  if (data.featured !== undefined) data.featured = toBool(data.featured);
  if (data.is_new_arrival !== undefined) data.is_new_arrival = toBool(data.is_new_arrival);
  if (data.is_weekly_offer !== undefined) data.is_weekly_offer = toBool(data.is_weekly_offer);
  if (data.sizes !== undefined) data.sizes = toArray(data.sizes);
  if (data.colors !== undefined) data.colors = toArray(data.colors);
  if (data.tags !== undefined) data.tags = toArray(data.tags);
  if (data.category_id === '' || data.category_id === 'null') data.category_id = null;
  // variants are handled separately
  delete data.variants;
  return data;
};

const syncVariants = async (productId, variantsRaw) => {
  if (variantsRaw === undefined) return;
  let variants = [];
  try {
    variants = typeof variantsRaw === 'string' ? JSON.parse(variantsRaw) : variantsRaw;
  } catch (_) { variants = []; }
  if (!Array.isArray(variants)) return;

  const existing = await ProductVariant.findAll({ where: { product_id: productId } });
  const keepIds = [];

  for (const v of variants) {
    const payload = {
      product_id: productId,
      size: v.size || null,
      color: v.color || null,
      sku: v.sku || null,
      price: v.price !== undefined && v.price !== '' ? v.price : null,
      stock: v.stock !== undefined && v.stock !== '' ? v.stock : 0,
      image: v.image || null,
    };
    if (v.id && existing.find(e => e.id === v.id)) {
      await ProductVariant.update(payload, { where: { id: v.id } });
      keepIds.push(v.id);
    } else {
      const created = await ProductVariant.create(payload);
      keepIds.push(created.id);
    }
  }

  const toRemove = existing.filter(e => !keepIds.includes(e.id)).map(e => e.id);
  if (toRemove.length) await ProductVariant.destroy({ where: { id: toRemove } });
};

exports.list = async (req, res) => {
  try {
    const { page=1, limit=20, search, category_id, vendor_id, status, featured, is_new_arrival, is_weekly_offer } = req.query;
    const where = {};
    if (category_id) where.category_id = category_id;
    if (vendor_id) where.vendor_id = vendor_id;
    if (status) where.status = status;
    if (featured !== undefined) where.featured = featured === 'true';
    if (is_new_arrival !== undefined) where.is_new_arrival = is_new_arrival === 'true';
    if (is_weekly_offer !== undefined) where.is_weekly_offer = is_weekly_offer === 'true';

    if (search) {
      // Search matches the product's own name/description fields, plus its
      // vendor's name and its category's name (AR/EN). Resolve matching IDs
      // first via a join query (no `variants` hasMany involved here), then
      // fetch the full paginated result set by ID — this avoids the
      // subQuery/hasMany pitfalls of filtering on association columns while
      // also including a hasMany (variants).
      const term = `%${search}%`;
      const matches = await Product.findAll({
        attributes: ['id'],
        where: {
          ...where,
          [Op.or]: [
            { name: { [Op.like]: term } },
            { name_ar: { [Op.like]: term } },
            { description: { [Op.like]: term } },
            { description_ar: { [Op.like]: term } },
            { '$vendor.name$': { [Op.like]: term } },
            { '$vendor.name_ar$': { [Op.like]: term } },
            { '$category.name$': { [Op.like]: term } },
            { '$category.name_ar$': { [Op.like]: term } },
          ],
        },
        include: [{ association: 'vendor', attributes: [] }, { association: 'category', attributes: [] }],
        subQuery: false,
      });
      where.id = { [Op.in]: matches.map(m => m.id) };
    }

    const { count, rows } = await Product.findAndCountAll({
      where, include: ['vendor','category','variants'], ...paginate(page, limit), order: [['created_at','DESC']],
      distinct: true,
    });
    res.json({ success: true, data: rows, meta: paginateResponse(count, page, limit) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.get = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, { include: ['vendor','category','variants'] });
    if (!product) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: product });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.create = async (req, res) => {
  try {
    const data = buildProductData(req.body);
    if (req.files?.length) data.images = req.files.map(f => `/uploads/${f.filename}`);
    const product = await Product.create(data);
    await syncVariants(product.id, req.body.variants);
    const result = await Product.findByPk(product.id, { include: ['vendor','category','variants'] });
    res.status(201).json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.update = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Not found' });
    const data = buildProductData(req.body);
    if (req.files?.length) data.images = req.files.map(f => `/uploads/${f.filename}`);
    await product.update(data);
    await syncVariants(product.id, req.body.variants);
    const result = await Product.findByPk(product.id, { include: ['vendor','category','variants'] });
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.remove = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Not found' });
    await product.destroy();
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
