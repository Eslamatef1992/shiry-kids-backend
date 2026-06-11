require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Role, Admin, Setting, SeoPage, CmsPage } = require('../models');

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await sequelize.sync();
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

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
      { key: 'twitter', value: '', group: 'social', label: 'Twitter', type: 'text' },
      { key: 'instagram', value: '', group: 'social', label: 'Instagram', type: 'text' },
      { key: 'linkedin', value: '', group: 'social', label: 'LinkedIn', type: 'text' },
      { key: 'snapchat', value: '', group: 'social', label: 'Snapchat', type: 'text' },
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

    // Seed CMS pages (About Us, Privacy Policy, Terms & Conditions)
    const cmsPages = [
      {
        slug: 'about-us',
        title: 'About Us',
        title_ar: 'من نحن',
        content: '<p>Shiry Kids is a fun e-commerce platform dedicated to bringing the best toys, books, art kits, and more to children across Kuwait.</p><p>Edit this page from the CMS to add your own About Us content.</p>',
        content_ar: '<p>شيري كيدز هي منصة تسوق إلكتروني ممتعة مخصصة لتوفير أفضل الألعاب والكتب وأدوات الفنون وغيرها للأطفال في جميع أنحاء الكويت.</p><p>قم بتعديل هذه الصفحة من لوحة التحكم لإضافة محتوى "من نحن" الخاص بك.</p>',
        status: 'published',
        sort: 1,
      },
      {
        slug: 'privacy-policy',
        title: 'Privacy Policy',
        title_ar: 'سياسة الخصوصية',
        content: '<p>This Privacy Policy describes how Shiry Kids collects, uses, and protects your information.</p><p>Edit this page from the CMS to add your own Privacy Policy content.</p>',
        content_ar: '<p>توضح سياسة الخصوصية هذه كيفية جمع شيري كيدز لمعلوماتك واستخدامها وحمايتها.</p><p>قم بتعديل هذه الصفحة من لوحة التحكم لإضافة محتوى سياسة الخصوصية الخاص بك.</p>',
        status: 'published',
        sort: 2,
      },
      {
        slug: 'terms-conditions',
        title: 'Terms & Conditions',
        title_ar: 'الشروط والأحكام',
        content: '<p>By using the Shiry Kids app, you agree to the following terms and conditions.</p><p>Edit this page from the CMS to add your own Terms & Conditions content.</p>',
        content_ar: '<p>باستخدامك لتطبيق شيري كيدز، فإنك توافق على الشروط والأحكام التالية.</p><p>قم بتعديل هذه الصفحة من لوحة التحكم لإضافة محتوى الشروط والأحكام الخاص بك.</p>',
        status: 'published',
        sort: 3,
      },
    ];
    for (const p of cmsPages) await CmsPage.findOrCreate({ where: { slug: p.slug }, defaults: p });

    console.log('✅ Seed complete — admin:', process.env.SEED_ADMIN_EMAIL);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
})();
