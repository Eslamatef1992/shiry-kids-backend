require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Role, Admin, Setting, SeoPage, CmsPage, LandingSection, LandingItem } = require('../models');

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
      // Tap Payments — controlled from the admin "Payment" tab. Mode switches
      // between the test and live key pairs below. Secret keys are never
      // exposed via /settings/public (see setting.controller.js).
      { key: 'tap_mode', value: 'test', group: 'payment', label: 'Tap Mode (test / live)', type: 'text' },
      { key: 'tap_test_secret_key', value: '', group: 'payment', label: 'Tap Test Secret Key', type: 'text' },
      { key: 'tap_test_publishable_key', value: '', group: 'payment', label: 'Tap Test Publishable Key', type: 'text' },
      { key: 'tap_live_secret_key', value: '', group: 'payment', label: 'Tap Live Secret Key', type: 'text' },
      { key: 'tap_live_publishable_key', value: '', group: 'payment', label: 'Tap Live Publishable Key', type: 'text' },
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

    // Seed landing page sections (shirykids.com)
    const landingSections = [
      {
        key: 'hero',
        content: {
          title: 'SHIRY KIDS FUN',
          title_ar: 'شيري كيدز فن',
          subtitle: 'Discover exclusive coupons, fun activities and unforgettable family experiences — all in one app.',
          subtitle_ar: 'اكتشف كوبونات حصرية وأنشطة ممتعة وتجارب عائلية لا تُنسى — كل ذلك في تطبيق واحد.',
          background_image: '',
          cta_primary_text: 'Download App',
          cta_primary_text_ar: 'حمل التطبيق',
          cta_primary_link: '#download',
          cta_secondary_text: 'Learn More',
          cta_secondary_text_ar: 'اعرف المزيد',
          cta_secondary_link: '#about',
        },
      },
      {
        key: 'about',
        content: {
          title: 'Shiry Kids Fun',
          title_ar: 'شيري كيدز فن',
          text: 'Shiry Kids Fun brings families closer together with exclusive digital coupons, fun activities and special offers from our trusted partners — all accessible from a single, easy-to-use mobile app.',
          text_ar: 'يجمع تطبيق شيري كيدز فن العائلات معًا من خلال كوبونات رقمية حصرية وأنشطة ممتعة وعروض خاصة من شركائنا الموثوقين — كل ذلك من خلال تطبيق واحد سهل الاستخدام.',
          image: '',
        },
      },
      {
        key: 'about2',
        content: {
          title: 'About Shiry Kids Fun',
          title_ar: 'عن شيري كيدز فن',
          text: 'Our mission is to make family fun more accessible and affordable. Browse a growing collection of partner venues and activities, redeem coupons instantly, and create memories that last.',
          text_ar: 'مهمتنا هي جعل المرح العائلي أكثر سهولة واقتصادية. تصفح مجموعة متنامية من الأماكن والأنشطة الشريكة، واستبدل الكوبونات فورًا، واصنع ذكريات تدوم.',
        },
      },
      {
        key: 'download_app',
        content: {
          title: 'Download Shiry Kids Fun Application',
          title_ar: 'حمل تطبيق شيري كيدز فن',
          subtitle: 'Available now on the App Store and Google Play. Download Shiry Kids Fun and start enjoying exclusive deals today.',
          subtitle_ar: 'متوفر الآن على App Store وGoogle Play. حمل تطبيق شيري كيدز فن وابدأ بالاستمتاع بالعروض الحصرية اليوم.',
          mockup_image: '',
          app_store_image: '',
          app_store_link: '',
          google_play_image: '',
          google_play_link: '',
        },
      },
      {
        key: 'footer',
        content: {
          copyright: `© ${new Date().getFullYear()} SHIRY KIDS FUN. ALL RIGHTS RESERVED.`,
          copyright_ar: `© ${new Date().getFullYear()} شيري كيدز فن. جميع الحقوق محفوظة.`,
          facebook_link: '',
          instagram_link: '',
          twitter_link: '',
          tiktok_link: '',
          youtube_link: '',
        },
      },
    ];
    for (const s of landingSections) await LandingSection.findOrCreate({ where: { key: s.key }, defaults: s });

    // Seed landing page items (how-to-use steps & why-choose-us cards)
    const landingItems = [
      { section: 'how_to_use', title: 'Sign Up', title_ar: 'إنشاء حساب', description: 'Create your free account in seconds.', description_ar: 'أنشئ حسابك المجاني في ثوانٍ.', sort: 1 },
      { section: 'how_to_use', title: 'Find Products & Coupons', title_ar: 'ابحث عن المنتجات والكوبونات', description: 'Browse exclusive deals from our partners.', description_ar: 'تصفح عروض حصرية من شركائنا.', sort: 2 },
      { section: 'how_to_use', title: 'Enjoy', title_ar: 'استمتع', description: 'Redeem your coupon and enjoy the experience.', description_ar: 'استبدل الكوبون واستمتع بالتجربة.', sort: 3 },
      { section: 'why_choose', title: 'User-Friendly Mobile App', title_ar: 'تطبيق سهل الاستخدام', description: 'A simple, intuitive app designed for the whole family.', description_ar: 'تطبيق بسيط وسهل مصمم لجميع أفراد العائلة.', sort: 1 },
      { section: 'why_choose', title: 'Instant Access To Digital Coupons', title_ar: 'وصول فوري للكوبونات الرقمية', description: 'Unlock and redeem coupons instantly from your phone.', description_ar: 'افتح واستبدل الكوبونات فورًا من هاتفك.', sort: 2 },
      { section: 'why_choose', title: 'Trusted Platform For Families', title_ar: 'منصة موثوقة للعائلات', description: 'Safe, reliable and trusted by families across Kuwait.', description_ar: 'آمنة وموثوقة من قبل العائلات في جميع أنحاء الكويت.', sort: 3 },
      { section: 'why_choose', title: 'Fast & Easy Ordering', title_ar: 'طلب سريع وسهل', description: 'Order products and redeem offers in just a few taps.', description_ar: 'اطلب المنتجات واستبدل العروض بضع نقرات فقط.', sort: 4 },
      { section: 'why_choose', title: 'Exclusive Offers & Deals', title_ar: 'عروض وصفقات حصرية', description: 'Get access to deals you won\'t find anywhere else.', description_ar: 'احصل على عروض لن تجدها في أي مكان آخر.', sort: 5 },
    ];
    for (const i of landingItems) {
      await LandingItem.findOrCreate({ where: { section: i.section, title: i.title }, defaults: i });
    }

    console.log('✅ Seed complete — admin:', process.env.SEED_ADMIN_EMAIL);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
})();
