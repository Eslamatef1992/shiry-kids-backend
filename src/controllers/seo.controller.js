const { SeoPage } = require('../models');

exports.list = async (req, res) => {
  try { res.json({ success: true, data: await SeoPage.findAll() }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.upsert = async (req, res) => {
  try {
    const { page, title, description, keywords, og_image } = req.body;
    const [seo] = await SeoPage.upsert({ page, title, description, keywords, og_image });
    res.json({ success: true, data: seo });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
