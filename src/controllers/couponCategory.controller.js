const { CouponCategory } = require('../models');

const toSlug = (str) => str.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

exports.list = async (req, res) => {
  try {
    const data = await CouponCategory.findAll({ order: [['sort', 'ASC'], ['id', 'ASC']] });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.create = async (req, res) => {
  try {
    const { name, name_ar, icon, slug, sort } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    const finalSlug = (slug && slug.trim()) ? slug.trim() : toSlug(name);
    const item = await CouponCategory.create({ name, name_ar, icon, slug: finalSlug, sort: sort || 0 });
    res.status(201).json({ success: true, data: item });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.update = async (req, res) => {
  try {
    const item = await CouponCategory.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    const { name, name_ar, icon, slug, sort, status } = req.body;
    const finalSlug = (slug && slug.trim()) ? slug.trim() : (name ? toSlug(name) : item.slug);
    await item.update({ name, name_ar, icon, slug: finalSlug, sort, status });
    res.json({ success: true, data: item });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.remove = async (req, res) => {
  try {
    const item = await CouponCategory.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    await item.destroy();
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
