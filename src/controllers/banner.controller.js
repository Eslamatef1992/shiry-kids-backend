const { Banner } = require('../models');

exports.list = async (req, res) => {
  try {
    const where = {};
    if (!req.admin) where.status = 'active'; // public: active only
    const rows = await Banner.findAll({ where, order: [['sort','ASC'],['created_at','DESC']] });
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.create = async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.image = `/uploads/${req.file.filename}`;
    const banner = await Banner.create(data);
    res.status(201).json({ success: true, data: banner });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.update = async (req, res) => {
  try {
    const banner = await Banner.findByPk(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: 'Not found' });
    const data = { ...req.body };
    if (req.file) data.image = `/uploads/${req.file.filename}`;
    await banner.update(data);
    res.json({ success: true, data: banner });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.remove = async (req, res) => {
  try {
    const banner = await Banner.findByPk(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: 'Not found' });
    await banner.destroy();
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
