#!/bin/bash

# Email Platform Deployment Script
# This script sets up the production environment

set -e

echo "🚀 Starting Email Platform deployment..."

# Configuration
APP_NAME="email-platform"
APP_USER="email-platform"
APP_DIR="/opt/email-platform"
DB_NAME="email_platform"
DB_USER="email_platform"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root"
   exit 1
fi

# Update system
print_status "Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt update && apt upgrade -y

# Install required packages
print_status "Installing required packages..."
apt install -y nodejs npm mysql-server nginx certbot python3-certbot-nginx curl

# Start and enable MySQL service
print_status "Starting MySQL service..."
systemctl start mysql
systemctl enable mysql

# Install PM2 for process management
print_status "Installing PM2..."
npm install -g pm2

# Create application user
print_status "Creating application user..."
if ! id "$APP_USER" &>/dev/null; then
    useradd -r -s /bin/false -d $APP_DIR $APP_USER
fi

# Create application directory
print_status "Setting up application directory..."
mkdir -p $APP_DIR
mkdir -p $APP_DIR/logs
chown -R $APP_USER:$APP_USER $APP_DIR

# Setup MySQL database
print_status "Setting up MySQL database..."
mysql -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;" 2>/dev/null || true
mysql -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY 'secure_password_here';" 2>/dev/null || true
mysql -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';" 2>/dev/null || true
mysql -e "FLUSH PRIVILEGES;" 2>/dev/null || true

# Copy application files (assumes you're running from the project directory)
print_status "Copying application files..."
rsync -av --exclude=node_modules --exclude=.git --exclude=dist . $APP_DIR/
chown -R $APP_USER:$APP_USER $APP_DIR

# Install dependencies
print_status "Installing Node.js dependencies..."
cd $APP_DIR
sudo -u $APP_USER npm install --production --no-optional

# Build frontend
print_status "Building frontend..."
sudo -u $APP_USER npm run build

# Verify dist folder was created
if [ ! -d "$APP_DIR/dist" ]; then
    print_error "Frontend build failed - dist folder not created"
    exit 1
fi

print_status "Frontend built successfully"

# Run database migrations
print_status "Running database migrations..."
sudo -u $APP_USER npm run db:migrate 2>/dev/null || print_warning "Database migration failed - continuing anyway"
sudo -u $APP_USER npm run db:seed 2>/dev/null || print_warning "Database seeding failed - continuing anyway"

# Setup systemd service
print_status "Setting up systemd service..."
cp systemd/email-platform.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable email-platform

# Setup Nginx
print_status "Configuring Nginx..."
cp deployment/nginx.conf /etc/nginx/sites-available/email-platform
ln -sf /etc/nginx/sites-available/email-platform /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
if nginx -t; then
    print_status "Nginx configuration is valid"
else
    print_error "Nginx configuration test failed"
    exit 1
fi

# Start services
print_status "Starting services..."
systemctl start email-platform
systemctl restart nginx

# Setup log rotation
print_status "Setting up log rotation..."
cat > /etc/logrotate.d/email-platform << EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
    su $APP_USER $APP_USER
}
EOF

# Setup firewall (optional)
print_status "Configuring firewall..."
if command -v ufw >/dev/null 2>&1; then
    ufw --force enable
    ufw allow 22
    ufw allow 80
    ufw allow 443
    ufw allow 3306
else
    print_warning "UFW not available, skipping firewall configuration"
fi

# Create backup script
print_status "Setting up backup script..."
cat > /usr/local/bin/backup-email-platform.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
mysqldump email_platform > $BACKUP_DIR/db_backup_$DATE.sql 2>/dev/null || echo "Database backup failed"

# Backup application files
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz -C /opt email-platform 2>/dev/null || echo "Application backup failed"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete 2>/dev/null || true
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete 2>/dev/null || true
EOF

chmod +x /usr/local/bin/backup-email-platform.sh

# Setup daily backup cron job
print_status "Setting up daily backups..."
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-email-platform.sh") | crontab -

# Final status check
print_status "Checking service status..."
if systemctl is-active --quiet email-platform; then
    print_status "Email platform service is running"
else
    print_warning "Email platform service is not running - check logs with: journalctl -u email-platform"
fi

if systemctl is-active --quiet nginx; then
    print_status "Nginx service is running"
else
    print_warning "Nginx service is not running - check logs with: journalctl -u nginx"
fi

print_status "Deployment completed! 🎉"
print_warning "Don't forget to:"
print_warning "1. Update the domain name in /etc/nginx/sites-available/email-platform"
print_warning "2. Set up SSL with: certbot --nginx -d your-domain.com"
print_warning "3. Update environment variables in /etc/systemd/system/email-platform.service"
print_warning "4. Change default database password"
print_warning "5. Restart services after configuration changes: systemctl restart email-platform nginx"

echo ""
echo "📋 Application Info:"
echo "   - Application URL: http://your-server-ip"
echo "   - Application Directory: $APP_DIR"
echo "   - Log Files: $APP_DIR/logs/"
echo "   - Service Status: systemctl status email-platform"
echo "   - Nginx Status: systemctl status nginx"
echo "   - Default Login: admin@demo.com / admin123"
echo ""
echo "🔧 Troubleshooting:"
echo "   - View application logs: journalctl -u email-platform -f"
echo "   - View nginx logs: tail -f /var/log/nginx/email-platform.*.log"
echo "   - Test database connection: mysql -u $DB_USER -p $DB_NAME"