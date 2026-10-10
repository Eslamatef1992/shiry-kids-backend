const { Setting } = require('../models');
const { Op } = require('sequelize');

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

// Returns all settings EXCEPT the 'payment' group, which holds Tap secret/
// publishable keys. Those must never be exposed via this public endpoint —
// the app gets what it needs (mode + publishable key) from /payments/config.
// GET /app/version — public endpoint for force-update check
exports.appVersion = async (req, res) => {
  try {
    const keys = ['app_android_min_version','app_ios_min_version','app_android_store_url','app_ios_store_url','app_force_update'];
    const rows = await Setting.findAll({ where: { key: keys } });
    const map = {};
    for (const r of rows) map[r.key] = r.value;
    res.json({
      success: true,
      data: {
        android_min_version: map['app_android_min_version'] || '1.0.0',
        ios_min_version:     map['app_ios_min_version']     || '1.0.0',
        android_store_url:   map['app_android_store_url']   || '',
        ios_store_url:       map['app_ios_store_url']        || '',
        force_update:        map['app_force_update']         === 'true',
      },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.public = async (req, res) => {
  try {
    const settings = await Setting.findAll({ where: { group: { [Op.ne]: 'payment' } } });
    const data = settings.reduce((acc, s) => { acc[s.key] = s.value; return acc; }, {});
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
