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
DB_PASSWORD="$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-25)"
JWT_SECRET="$(openssl rand -base64 64 | tr -d '\n')"

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

# Set environment variables for headless operation
export DEBIAN_FRONTEND=noninteractive
export NODE_ENV=production

# Update system
print_status "Updating system packages..."
apt update && apt upgrade -y

# Install required packages
print_status "Installing required packages..."
apt install -y nodejs npm mysql-server nginx certbot python3-certbot-nginx curl

# Start and enable MySQL service
print_status "Starting MySQL service..."
systemctl start mysql
systemctl enable mysql

# Wait for MySQL to be ready
print_status "Waiting for MySQL to be ready..."
sleep 10

# Function to test MySQL connection
test_mysql_connection() {
    local user="$1"
    local password="$2"
    local auth_method="$3"
    
    case "$auth_method" in
        "no_password")
            mysql -u "$user" -e "SELECT 1;" 2>/dev/null
            ;;
        "sudo")
            sudo mysql -u "$user" -e "SELECT 1;" 2>/dev/null
            ;;
        "password")
            mysql -u "$user" -p"$password" -e "SELECT 1;" 2>/dev/null
            ;;
    esac
}

# Setup MySQL database
print_status "Setting up MySQL database..."

# Try different authentication methods
MYSQL_AUTH_METHOD=""
if test_mysql_connection "root" "" "no_password"; then
    MYSQL_AUTH_METHOD="no_password"
    print_status "Using MySQL root without password"
elif test_mysql_connection "root" "" "sudo"; then
    MYSQL_AUTH_METHOD="sudo"
    print_status "Using MySQL root with sudo"
else
    print_error "Cannot connect to MySQL. Please check MySQL installation."
    exit 1
fi

# Create database and user
print_status "Creating database and user..."

case "$MYSQL_AUTH_METHOD" in
    "no_password")
        mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS $DB_NAME;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOF
        ;;
    "sudo")
        sudo mysql <<EOF
CREATE DATABASE IF NOT EXISTS $DB_NAME;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOF
        ;;
esac

print_status "Database setup completed"

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

# Copy application files (assumes you're running from the project directory)
print_status "Copying application files..."
rsync -av --exclude=node_modules --exclude=.git --exclude=dist . $APP_DIR/
chown -R $APP_USER:$APP_USER $APP_DIR

# Create environment file
print_status "Creating environment configuration..."
cat > $APP_DIR/.env << EOF
NODE_ENV=production
PORT=3001
DB_HOST=localhost
DB_PORT=3306
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME
JWT_SECRET=$JWT_SECRET
FRONTEND_URL=https://your-domain.com
EOF

chown $APP_USER:$APP_USER $APP_DIR/.env
chmod 600 $APP_DIR/.env

# Install dependencies
print_status "Installing Node.js dependencies..."
cd $APP_DIR

# Install dependencies as app user
sudo -u $APP_USER bash -c "
export NODE_ENV=production
npm install --production --no-optional
"

# Build frontend
print_status "Building frontend..."
sudo -u $APP_USER bash -c "
export NODE_ENV=production
npm run build
"

# Verify dist folder was created
if [ ! -d "$APP_DIR/dist" ]; then
    print_error "Frontend build failed - dist folder not created"
    exit 1
fi

print_status "Frontend built successfully"

# Run database migrations
print_status "Running database migrations..."
sudo -u $APP_USER bash -c "
cd $APP_DIR
export NODE_ENV=production
source .env
npm run db:migrate || echo 'Database migration failed - continuing anyway'
npm run db:seed || echo 'Database seeding failed - continuing anyway'
"

# Create systemd service
print_status "Setting up systemd service..."
cat > /etc/systemd/system/email-platform.service << EOF
[Unit]
Description=Email Management Platform
After=network.target
After=mysql.service
Requires=mysql.service

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=email-platform

# Load environment from file
EnvironmentFile=$APP_DIR/.env

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR/logs
ReadWritePaths=/tmp

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF

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

# Load database credentials
source /opt/email-platform/.env

# Backup database
mysqldump -u $DB_USER -p$DB_PASSWORD $DB_NAME > $BACKUP_DIR/db_backup_$DATE.sql 2>/dev/null || echo "Database backup failed"

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
print_warning "3. Update FRONTEND_URL in $APP_DIR/.env after setting up your domain"
print_warning "4. Restart services after configuration changes: systemctl restart email-platform nginx"

echo ""
echo "📋 Application Info:"
echo "   - Application URL: http://your-server-ip"
echo "   - Application Directory: $APP_DIR"
echo "   - Environment File: $APP_DIR/.env"
echo "   - Log Files: $APP_DIR/logs/"
echo "   - Service Status: systemctl status email-platform"
echo "   - Nginx Status: systemctl status nginx"
echo "   - Default Login: admin@demo.com / admin123"
echo ""
echo "🔧 Database Info:"
echo "   - Database Name: $DB_NAME"
echo "   - Database User: $DB_USER"
echo "   - Database Password: $DB_PASSWORD"
echo "   - Test Connection: mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME"
echo ""
echo "🔧 Troubleshooting:"
echo "   - View application logs: journalctl -u email-platform -f"
echo "   - View nginx logs: tail -f /var/log/nginx/email-platform.*.log"
echo "   - Check environment: cat $APP_DIR/.env"