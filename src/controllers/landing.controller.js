const { LandingSection, LandingItem } = require('../models');

// ── Public: full landing page content ──────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const sections = await LandingSection.findAll();
    const items = await LandingItem.findAll({
      where: { status: 'active' },
      order: [['sort', 'ASC'], ['id', 'ASC']],
    });

    const sectionsMap = {};
    sections.forEach(s => { sectionsMap[s.key] = s.content || {}; });

    const itemsMap = {};
    items.forEach(i => {
      if (!itemsMap[i.section]) itemsMap[i.section] = [];
      itemsMap[i.section].push(i);
    });

    res.json({ success: true, data: { sections: sectionsMap, items: itemsMap } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Admin: sections ──────────────────────────────────────────────────────────────
exports.listSections = async (req, res) => {
  try {
    const sections = await LandingSection.findAll();
    const sectionsMap = {};
    sections.forEach(s => { sectionsMap[s.key] = s.content || {}; });
    res.json({ success: true, data: sectionsMap });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.upsertSection = async (req, res) => {
  try {
    const { key } = req.params;
    let content = req.body.content;
    if (typeof content === 'string') {
      try { content = JSON.parse(content); } catch { /* keep as-is */ }
    }
    const [section] = await LandingSection.findOrCreate({ where: { key }, defaults: { content: {} } });
    await section.update({ content: content || {} });
    res.json({ success: true, data: section });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Admin: repeatable items ───────────────────────────────────────────────────────
exports.listItems = async (req, res) => {
  try {
    const where = {};
    if (req.query.section) where.section = req.query.section;
    if (!req.admin) where.status = 'active';
    const rows = await LandingItem.findAll({ where, order: [['sort', 'ASC'], ['id', 'ASC']] });
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.createItem = async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.image = `/uploads/${req.file.filename}`;
    const item = await LandingItem.create(data);
    res.status(201).json({ success: true, data: item });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.updateItem = async (req, res) => {
  try {
    const item = await LandingItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    const data = { ...req.body };
    if (req.file) data.image = `/uploads/${req.file.filename}`;
    await item.update(data);
    res.json({ success: true, data: item });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.removeItem = async (req, res) => {
  try {
    const item = await LandingItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    await item.destroy();
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Admin: generic image upload (used for section image fields) ──────────────────
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    res.status(201).json({ success: true, data: { url: `/uploads/${req.file.filename}` } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
