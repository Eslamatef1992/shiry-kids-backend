module.exports = {
  apps: [
    {
      name: 'shiry-kids-backend',
      script: './src/app.js',
      cwd: '/var/www/shiry-kids-backend',
      instances: 'max',          // one worker per CPU core
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/pm2/shiry-kids-backend-error.log',
      out_file:   '/var/log/pm2/shiry-kids-backend-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
