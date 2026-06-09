const { CmsPage } = require('../models');

exports.list = async (req, res) => {
  try { res.json({ success: true, data: await CmsPage.findAll({ order: [['sort','ASC']] }) }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.get = async (req, res) => {
  try {
    const page = await CmsPage.findOne({ where: { slug: req.params.slug } });
    if (!page) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: page });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.create = async (req, res) => {
  try { res.status(201).json({ success: true, data: await CmsPage.create(req.body) }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.update = async (req, res) => {
  try {
    const page = await CmsPage.findByPk(req.params.id);
    if (!page) return res.status(404).json({ success: false, message: 'Not found' });
    await page.update(req.body);
    res.json({ success: true, data: page });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.remove = async (req, res) => {
  try {
    await CmsPage.destroy({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
