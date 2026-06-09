#!/usr/bin/env bash
# deploy.sh — first-time VPS setup + deploy for shiry-kids-backend & admin panel
# Run as root (or sudo) on Ubuntu 22.04
# Usage: bash deploy.sh

set -e

BACKEND_DIR="/var/www/shiry-kids-backend"
ADMIN_DIR="/var/www/shiry-kids-admin"
BACKEND_REPO="https://github.com/eslamatef1992/shiry-kids-backend.git"
ADMIN_REPO="https://github.com/eslamatef1992/shiry-kids-admin.git"

echo "==> Installing system dependencies..."
apt-get update -y
apt-get install -y git curl nginx certbot python3-certbot-nginx

# Node.js 20 LTS
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# PM2
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2
  pm2 startup systemd -u root --hp /root
fi

# ── Backend ───────────────────────────────────────────────────────────────────
echo "==> Deploying backend..."
if [ -d "$BACKEND_DIR" ]; then
  git -C "$BACKEND_DIR" pull
else
  git clone "$BACKEND_REPO" "$BACKEND_DIR"
fi

cd "$BACKEND_DIR"
npm install --omit=dev

# Copy .env if it doesn't exist yet
[ -f .env ] || cp .env.example .env
echo "!! Edit $BACKEND_DIR/.env before continuing !!"
read -p "Press ENTER once .env is configured..."

# Run migrations + seed
node src/config/migrate.js
node src/config/seed.js

# (Re)start with PM2
pm2 delete shiry-kids-backend 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save

# ── Admin panel ───────────────────────────────────────────────────────────────
echo "==> Deploying admin panel..."
if [ -d "$ADMIN_DIR" ]; then
  git -C "$ADMIN_DIR" pull
else
  git clone "$ADMIN_REPO" "$ADMIN_DIR"
fi

cd "$ADMIN_DIR"
npm install
npm run build   # output → dist/

# ── nginx ─────────────────────────────────────────────────────────────────────
echo "==> Configuring nginx..."
cp "$BACKEND_DIR/nginx/back.shirykids.com.conf"  /etc/nginx/sites-available/back.shirykids.com
cp "$BACKEND_DIR/nginx/admin.shirykids.com.conf" /etc/nginx/sites-available/admin.shirykids.com

ln -sf /etc/nginx/sites-available/back.shirykids.com  /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/admin.shirykids.com /etc/nginx/sites-enabled/

# Remove default site if present
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx

# ── SSL certificates (Certbot) ────────────────────────────────────────────────
echo "==> Obtaining SSL certificates..."
certbot --nginx -d back.shirykids.com  --non-interactive --agree-tos -m eslam@teknulugy.com
certbot --nginx -d admin.shirykids.com --non-interactive --agree-tos -m eslam@teknulugy.com

systemctl reload nginx

echo ""
echo "======================================================"
echo "  Deployment complete!"
echo "  Backend:    https://back.shirykids.com/health"
echo "  Admin panel: https://admin.shirykids.com"
echo "======================================================"
