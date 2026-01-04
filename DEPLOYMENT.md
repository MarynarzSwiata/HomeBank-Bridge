# 🚀 HomeBank Bridge Deployment Options

## 📋 Can It Run on a Regular Web Server?

**YES! HomeBank Bridge CAN run on a traditional web server with Node.js!**

The application is **not limited to containerized deployment (Docker)** only. There are two main deployment options:

1. ✅ **Traditional Web Server with Node.js** (VPS, dedicated server)
2. ✅ **Containerized Deployment** (Docker, Coolify, Kubernetes)

---

## 🏗️ Application Architecture

HomeBank Bridge consists of three main components:

```
┌─────────────────────────────────────────┐
│  Frontend (React 19)                    │
│  └─ Compiles to static files            │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Backend API (Node.js + Express)        │
│  └─ Serves API and static files         │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Database (SQLite)                      │
│  └─ File: backend/data/data.db          │
│  └─ Sessions: backend/data/sessions.db  │
└─────────────────────────────────────────┘
```

### Key Features:
- **SQLite** = file-based database (no separate DB server required)
- **Backend** = Node.js server listening on a port (default: 3000)
- **Frontend** = static HTML/JS/CSS files served by backend

---

## 🖥️ Option 1: Traditional Web Server

### Requirements:
- **Operating System**: Linux (Ubuntu/Debian), macOS, or Windows Server
- **Node.js**: version 18 or newer
- **npm**: Node.js package manager
- **File system access**: for SQLite database writes
- **Port**: 3000 (or custom port)
- **RAM**: minimum 512 MB (recommended 1 GB)
- **Disk space**: minimum 500 MB

### Step-by-Step Deployment:

#### 1. Server Preparation

```bash
# Update system (Ubuntu/Debian)
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+ (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify versions
node --version  # Should be v18.x.x or higher
npm --version
```

#### 2. Clone and Configure Project

```bash
# Navigate to application directory
cd /var/www  # or your preferred directory

# Clone repository
git clone https://github.com/MarynarzSwiata/HomeBank-Bridge.git
cd HomeBank-Bridge

# Install root project dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

#### 3. Environment Configuration

```bash
# Copy example configuration file
cp .env.example .env

# Edit the .env file
nano .env
```

Set the following environment variables:

```bash
# Backend
PORT=3000
NODE_ENV=production
FRONTEND_URL=http://your-domain.com  # or http://ip-address:3000

# Authentication (IMPORTANT: change to your own secret!)
SESSION_SECRET=your-very-secure-secret-minimum-32-characters
ALLOW_REGISTRATION=false  # true if you want to allow registration

# Frontend (not used in production - frontend is bundled)
# VITE_API_URL=http://localhost:3000/api
```

#### 4. Build Application

```bash
# Build frontend (compile to static files)
npm run build

# Files will be generated in ./dist directory
```

#### 5. Prepare Production Structure

```bash
# Create data directory (SQLite database)
mkdir -p backend/data

# Set appropriate permissions
chmod 755 backend/data
```

#### 6. Run Application

**Option A: Direct (for testing)**
```bash
cd backend
NODE_ENV=production node server.js
```

**Option B: With PM2 (recommended for production)**
```bash
# Install PM2 globally
sudo npm install -g pm2

# Start application with PM2
cd backend
pm2 start server.js --name homebank-bridge --node-args="--max-old-space-size=512"

# Save PM2 configuration
pm2 save

# Set up autostart on server reboot
pm2 startup
# Execute the command that PM2 displays
```

**Option C: With systemd (system service)**

Create service file:
```bash
sudo nano /etc/systemd/system/homebank-bridge.service
```

File contents:
```ini
[Unit]
Description=HomeBank Bridge Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/HomeBank-Bridge/backend
Environment="NODE_ENV=production"
Environment="PORT=3000"
Environment="SESSION_SECRET=your-secret-here"
Environment="FRONTEND_URL=http://your-domain.com"
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Start service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable homebank-bridge
sudo systemctl start homebank-bridge
sudo systemctl status homebank-bridge
```

#### 7. Configure Reverse Proxy (optional but recommended)

**Nginx:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Apache:**
```apache
<VirtualHost *:80>
    ServerName your-domain.com
    
    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
    
    <Location />
        Require all granted
    </Location>
</VirtualHost>
```

#### 8. SSL/HTTPS (recommended for production)

```bash
# Install Certbot (Let's Encrypt)
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com
```

### Managing Application on Traditional Server:

**With PM2:**
```bash
# Application status
pm2 status

# Real-time logs
pm2 logs homebank-bridge

# Restart
pm2 restart homebank-bridge

# Stop
pm2 stop homebank-bridge

# Monitor
pm2 monit
```

**With systemd:**
```bash
# Status
sudo systemctl status homebank-bridge

# Logs
sudo journalctl -u homebank-bridge -f

# Restart
sudo systemctl restart homebank-bridge

# Stop
sudo systemctl stop homebank-bridge
```

### Application Updates:

```bash
# Stop application
pm2 stop homebank-bridge  # or: sudo systemctl stop homebank-bridge

# Pull latest version
git pull origin main

# Install new dependencies (if any)
npm install
cd backend && npm install && cd ..

# Rebuild frontend
npm run build

# Restart
pm2 restart homebank-bridge  # or: sudo systemctl start homebank-bridge
```

---

## 🐳 Option 2: Containerized Deployment (Docker)

### Requirements:
- **Docker**: version 20.10 or newer
- **Docker Compose**: (optional, for easier management)

### Deployment Instructions:

#### 1. Preparation

```bash
# Install Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

#### 2. Build Image

```bash
# Clone repository
git clone https://github.com/MarynarzSwiata/HomeBank-Bridge.git
cd HomeBank-Bridge

# Build Docker image
docker build -t homebank-bridge:latest .
```

#### 3. Run Container

```bash
# Create data directory (outside container)
mkdir -p ./hb-data

# Run container
docker run -d \
  --name homebank-bridge \
  -p 3000:3000 \
  -v $(pwd)/hb-data:/app/backend/data \
  -e SESSION_SECRET="your-secure-secret-min-32-chars" \
  -e FRONTEND_URL="http://your-domain.com" \
  -e ALLOW_REGISTRATION="false" \
  --restart unless-stopped \
  homebank-bridge:latest
```

#### 4. Docker Compose (recommended)

Create `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  homebank-bridge:
    build: .
    container_name: homebank-bridge
    ports:
      - "3000:3000"
    volumes:
      - ./hb-data:/app/backend/data
    environment:
      - NODE_ENV=production
      - SESSION_SECRET=your-secure-secret-minimum-32-characters
      - FRONTEND_URL=http://your-domain.com
      - ALLOW_REGISTRATION=false
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 5s
```

Run:
```bash
docker-compose up -d
```

### Container Management:

```bash
# Status
docker ps

# Logs
docker logs -f homebank-bridge

# Restart
docker restart homebank-bridge

# Stop
docker stop homebank-bridge

# Remove container
docker rm homebank-bridge
```

---

## 📊 Deployment Options Comparison

| Criterion | Traditional Server | Docker |
|-----------|-------------------|---------|
| **Installation Ease** | Medium (more steps) | Easy (single image) |
| **Isolation** | None (shares system) | Full (container) |
| **Performance** | Slightly better (native) | Very good (minimal overhead) |
| **Updates** | Manual (git pull + rebuild) | Easy (pull image) |
| **Resource Usage** | Lower (direct on system) | Slightly higher (Docker layer) |
| **Portability** | System-dependent | Full (runs anywhere) |
| **Backup** | Copy data/ directory | Copy volume + image |
| **Scalability** | Limited | Easy (orchestration) |
| **Security** | Depends on server config | Better isolation |
| **Recommended For** | VPS, dedicated servers | All environments |

---

## 💾 SQLite Database - Important Information

### How Does It Work?

SQLite is a **file-based database**. It doesn't require a separate database server (like MySQL or PostgreSQL). All data is stored in files:

```
backend/data/
├── data.db           # Main application database
├── data.db-shm       # Shared memory file (temporary)
├── data.db-wal       # Write-Ahead Log
└── sessions.db       # User sessions database
```

### SQLite Advantages for This Project:
- ✅ No need to install and configure database server
- ✅ Zero maintenance - no DB process to manage
- ✅ Excellent performance for small/medium applications
- ✅ Atomic transactions and full data integrity
- ✅ Easy backup (copy .db file)

### Limitations:
- ⚠️ Not suitable for massive loads (thousands of concurrent users)
- ⚠️ One write process at a time (but many reads)
- ⚠️ Network access only through backend API (no direct connection)

### Database Backup:

```bash
# Traditional server
cd /var/www/HomeBank-Bridge/backend
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# Docker
docker exec homebank-bridge tar -czf /tmp/backup.tar.gz /app/backend/data
docker cp homebank-bridge:/tmp/backup.tar.gz ./backup-$(date +%Y%m%d).tar.gz
```

---

## 🔧 Migration Between Options

### From Traditional Server to Docker:

```bash
# 1. Backup database
cd /var/www/HomeBank-Bridge/backend
cp -r data/ ~/homebank-backup/

# 2. Build Docker image
cd /var/www/HomeBank-Bridge
docker build -t homebank-bridge .

# 3. Run with volume pointing to backup
docker run -d \
  -p 3000:3000 \
  -v ~/homebank-backup:/app/backend/data \
  -e SESSION_SECRET="your-secret" \
  homebank-bridge
```

### From Docker to Traditional Server:

```bash
# 1. Copy data from container
docker cp homebank-bridge:/app/backend/data ./data-backup

# 2. Install application traditionally (see section above)

# 3. Copy database
cp -r ./data-backup/* /var/www/HomeBank-Bridge/backend/data/

# 4. Start application
pm2 start server.js --name homebank-bridge
```

---

## 🎯 Recommendations

### For Single User / Family:
- ✅ **Traditional Server** - simpler, fewer layers
- VPS with 1GB RAM is sufficient
- PM2 for process management
- Nginx as reverse proxy

### For Small Team / Business:
- ✅ **Docker** - easier updates and backup
- Docker Compose for convenience
- Easy migration capability

### For Production Environment:
- ✅ **Docker + Coolify** (as in documentation)
- Automatic deployments
- Monitoring and logs
- SSL out-of-the-box

---

## ❓ Frequently Asked Questions

### 1. Do I need MySQL/PostgreSQL?
**No!** SQLite is built-in. You don't need a separate database server.

### 2. Can I run this on shared hosting?
**Probably not.** You need:
- SSH access
- Ability to install Node.js
- Ability to run your own processes
- Port access

Typical PHP shared hosting won't work. You need VPS or dedicated server.

### 3. How much resources does the application need?
- **RAM**: 512 MB - 1 GB (recommended 1 GB)
- **CPU**: 1 vCore is enough
- **Disk**: 1-2 GB (depending on data amount)
- **Bandwidth**: minimal

### 4. Is the database secure?
Yes, provided:
- ✅ `backend/data/` directory is not web-accessible
- ✅ You have backups
- ✅ Regular system updates
- ✅ Strong SESSION_SECRET

### 5. How often should I backup?
- **Daily** for production
- **Weekly** for personal use
- **Automatic backups** recommended

### 6. Can I use PostgreSQL instead of SQLite?
Currently the application is designed for SQLite. Migration to PostgreSQL would require backend code modifications.

---

## 📞 Support

- **GitHub Issues**: https://github.com/MarynarzSwiata/HomeBank-Bridge/issues
- **Documentation**: README.md in repository

---

## ✅ Summary

**HomeBank Bridge CAN run on a regular web server!**

You have a choice:
1. **Traditional server with Node.js** - full control, direct installation
2. **Docker deployment** - easier management, better portability

Both approaches are fully supported and work with SQLite database, which doesn't require a separate database server.

The choice depends on your preferences, skills, and infrastructure.
