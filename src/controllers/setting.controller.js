const { Setting } = require('../models');

exports.list = async (req, res) => {
  try {
    const settings = await Setting.findAll({ order: [['group','ASC'],['key','ASC']] });
    const grouped = settings.reduce((acc, s) => {
      if (!acc[s.group]) acc[s.group] = [];
      acc[s.group].push(s);
      return acc;
    }, {});
    res.json({ success: true, data: grouped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.update = async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await Setting.update({ value: String(value) }, { where: { key } });
    }
    res.json({ success: true, message: 'Settings saved' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.public = async (req, res) => {
  try {
    const settings = await Setting.findAll();
    const data = settings.reduce((acc, s) => { acc[s.key] = s.value; return acc; }, {});
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
