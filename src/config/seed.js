require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Role, Admin, Setting, SeoPage } = require('../models');

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    // Seed roles
    const superAdmin = await Role.findOrCreate({
      where: { name: 'Super Admin' },
      defaults: { permissions: ['*'] },
    });
    await Role.findOrCreate({ where: { name: 'Admin' }, defaults: { permissions: ['read','write'] } });
    await Role.findOrCreate({ where: { name: 'Scanner' }, defaults: { permissions: ['scan_qr'] } });

    // Seed admin
    const hash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'Admin@123', 12);
    await Admin.findOrCreate({
      where: { email: process.env.SEED_ADMIN_EMAIL || 'admin@shirykids.com' },
      defaults: { name: 'Super Admin', password: hash, role_id: superAdmin[0].id, status: 'active' },
    });

    // Seed settings
    const settings = [
      { key: 'app_name', value: 'Shiry Kids Fun', group: 'general', label: 'App Name', type: 'text' },
      { key: 'app_logo', value: '', group: 'general', label: 'App Logo', type: 'image' },
      { key: 'primary_color', value: '#FF383C', group: 'general', label: 'Primary Color', type: 'text' },
      { key: 'currency', value: 'KD', group: 'general', label: 'Currency', type: 'text' },
      { key: 'delivery_fee', value: '1.5', group: 'shipping', label: 'Delivery Fee', type: 'number' },
      { key: 'min_order', value: '0', group: 'shipping', label: 'Minimum Order', type: 'number' },
      { key: 'contact_email', value: 'info@shirykids.com', group: 'contact', label: 'Contact Email', type: 'text' },
      { key: 'contact_phone', value: '', group: 'contact', label: 'Contact Phone', type: 'text' },
      { key: 'instagram', value: '', group: 'social', label: 'Instagram', type: 'text' },
      { key: 'whatsapp', value: '', group: 'social', label: 'WhatsApp', type: 'text' },
    ];
    for (const s of settings) await Setting.findOrCreate({ where: { key: s.key }, defaults: s });

    // Seed SEO pages
    const pages = ['home', 'products', 'coupons', 'cart', 'profile'];
    for (const p of pages) {
      await SeoPage.findOrCreate({
        where: { page: p },
        defaults: { title: `Shiry Kids - ${p}`, description: `Shiry Kids Fun ${p} page`, keywords: 'kids,fun,coupons' },
      });
    }

    console.log('✅ Seed complete — admin:', process.env.SEED_ADMIN_EMAIL);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
})();
