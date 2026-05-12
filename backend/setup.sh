#!/usr/bin/env bash
# EliteCode Backend — VM Setup Script
#
# Prerequisites:
#   1. Ubuntu 22.04 LTS VM (NOT 24.04 — Judge0 needs cgroup v1 memory)
#   2. Log into Docker Hub first:  sudo docker login
#   3. Create .env file:
#        cat > ~/.../elitecode/.env << 'EOF'
#        SUPABASE_URL=https://your-project.supabase.co
#        SUPABASE_SERVICE_ROLE_KEY=eyJ...
#        SUPABASE_JWT_SECRET=
#        JUDGE0_URL=http://localhost:2358
#        FRONTEND_URL=https://elite-code-frontend.pages.dev
#        EOF
#   4. chmod +x setup.sh && sudo ./setup.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_USER="${SUDO_USER:-$USER}"
JUDGE0_DIR="/opt/judge0"
JUDGE0_VERSION="v1.13.1"

echo "============================================="
echo " EliteCode Backend Setup"
echo " App dir  : $SCRIPT_DIR"
echo " App user : $APP_USER"
echo " Judge0   : $JUDGE0_VERSION"
echo "============================================="
echo ""

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  echo "ERROR: .env file not found at $SCRIPT_DIR/.env"
  echo ""
  echo "Create it first:"
  echo "  nano $SCRIPT_DIR/.env"
  echo ""
  echo "Required contents:"
  echo "  SUPABASE_URL=https://your-project.supabase.co"
  echo "  SUPABASE_SERVICE_ROLE_KEY=eyJ..."
  echo "  SUPABASE_JWT_SECRET="
  echo "  JUDGE0_URL=http://localhost:2358"
  echo "  FRONTEND_URL=https://elite-code-frontend.pages.dev"
  exit 1
fi

# Warn if Docker Hub login is missing (pull will stall without it)
if ! docker info 2>/dev/null | grep -q "Username"; then
  echo "WARNING: Not logged into Docker Hub."
  echo "  Run: sudo docker login"
  echo "  Then re-run this script."
  echo "  (Without login, image pulls will stall at rate limits)"
  echo ""
  read -rp "Continue anyway? [y/N] " yn
  [[ "$yn" =~ ^[Yy]$ ]] || exit 1
fi

# ---------------------------------------------------------------------------
# 1. System packages
# ---------------------------------------------------------------------------
echo ">>> [1/7] Installing system packages..."
apt-get update -q
apt-get install -y -q \
  ca-certificates curl gnupg lsb-release \
  python3-pip python3-venv \
  nginx unzip git nano openssl

# Add Docker's official apt repository
if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
fi

apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin

usermod -aG docker "$APP_USER"

# Fix MTU for GCP (GCP uses 1460, Docker defaults to 1500 — causes pull stalls)
cat > /etc/docker/daemon.json << 'DOCKERCFG'
{
  "mtu": 1460
}
DOCKERCFG

systemctl enable docker --now
systemctl restart docker

# ---------------------------------------------------------------------------
# 2. Python virtualenv + dependencies
# ---------------------------------------------------------------------------
echo ">>> [2/7] Installing Python dependencies..."
python3 -m venv "$SCRIPT_DIR/.venv"
"$SCRIPT_DIR/.venv/bin/pip" install -q --upgrade pip
"$SCRIPT_DIR/.venv/bin/pip" install -q -r "$SCRIPT_DIR/requirements.txt"

# ---------------------------------------------------------------------------
# 3. Judge0 CE (code execution engine — binds to localhost:2358)
# ---------------------------------------------------------------------------
echo ">>> [3/7] Setting up Judge0 CE..."
mkdir -p "$JUDGE0_DIR"

# Download Judge0 CE release
echo "    Downloading Judge0 ${JUDGE0_VERSION}..."
curl -sL \
  "https://github.com/judge0/judge0/releases/download/${JUDGE0_VERSION}/judge0-${JUDGE0_VERSION}.zip" \
  -o /tmp/judge0.zip
unzip -q -o /tmp/judge0.zip -d /tmp/judge0_extract
cp "/tmp/judge0_extract/judge0-${JUDGE0_VERSION}/judge0.conf" "$JUDGE0_DIR/"
cp "/tmp/judge0_extract/judge0-${JUDGE0_VERSION}/docker-compose.yml" "$JUDGE0_DIR/"
rm -rf /tmp/judge0.zip /tmp/judge0_extract

# Generate secure random passwords (empty passwords cause postgres to crash-loop)
REDIS_PASS=$(openssl rand -hex 24)
PG_PASS=$(openssl rand -hex 24)
sed -i "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=${REDIS_PASS}/" "$JUDGE0_DIR/judge0.conf"
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${PG_PASS}/" "$JUDGE0_DIR/judge0.conf"

echo "    Passwords generated and saved to $JUDGE0_DIR/judge0.conf"

# ---------------------------------------------------------------------------
# 4. Start Judge0
# ---------------------------------------------------------------------------
echo ">>> [4/7] Pulling and starting Judge0 CE (~3.3 GB, takes 3-5 min)..."
cd "$JUDGE0_DIR"
docker compose pull
docker compose up -d
cd "$SCRIPT_DIR"

# Wait for Judge0 API to be ready (up to 3 minutes)
echo "    Waiting for Judge0 to be ready..."
for i in $(seq 1 36); do
  if curl -sf http://localhost:2358/about > /dev/null 2>&1; then
    echo "    Judge0 is up!"
    break
  fi
  echo "    Waiting... ($i/36, up to 3 min)"
  sleep 5
done

# ---------------------------------------------------------------------------
# 5. nginx reverse proxy
# ---------------------------------------------------------------------------
echo ">>> [5/7] Configuring nginx..."
EXTERNAL_IP=$(curl -sf \
  "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip" \
  -H "Metadata-Flavor: Google" 2>/dev/null || echo "_")

cat > /etc/nginx/sites-available/elitecode << NGINX
server {
    listen 80;
    server_name ${EXTERNAL_IP} _;

    client_max_body_size 1m;

    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   Authorization     \$http_authorization;
        proxy_read_timeout 90s;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/elitecode /etc/nginx/sites-enabled/elitecode
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ---------------------------------------------------------------------------
# 6. systemd service for FastAPI
# ---------------------------------------------------------------------------
echo ">>> [6/7] Creating systemd service..."
cat > /etc/systemd/system/elitecode.service << SERVICE
[Unit]
Description=EliteCode FastAPI Backend
After=network.target docker.service
Requires=docker.service

[Service]
User=${APP_USER}
WorkingDirectory=${SCRIPT_DIR}
EnvironmentFile=${SCRIPT_DIR}/.env
ExecStart=${SCRIPT_DIR}/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable elitecode
systemctl start elitecode

# ---------------------------------------------------------------------------
# 7. Done
# ---------------------------------------------------------------------------
echo ""
echo ">>> [7/7] Verifying..."
sleep 3
if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
  echo "    FastAPI is running."
else
  echo "    FastAPI not responding yet — check logs:"
  echo "      sudo journalctl -u elitecode -n 30"
fi

if curl -sf http://localhost:2358/about > /dev/null 2>&1; then
  echo "    Judge0 is running."
else
  echo "    Judge0 not responding — check:"
  echo "      cd /opt/judge0 && sudo docker compose ps"
  echo "      cd /opt/judge0 && sudo docker compose logs server --tail=30"
fi

echo ""
echo "============================================="
echo " Setup complete!"
echo " VM external IP : ${EXTERNAL_IP}"
echo " Health check   : curl http://${EXTERNAL_IP}/health"
echo "============================================="
echo ""
echo "Next steps:"
echo "  1. Update VITE_BACKEND_URL in frontend .env"
echo "  2. Set up Cloudflare Tunnel for HTTPS:"
echo "     curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg"
echo "     echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflareone focal main' | sudo tee /etc/apt/sources.list.d/cloudflare.list"
echo "     sudo apt update && sudo apt install cloudflared"
echo "     cloudflared tunnel --url http://localhost:8000"
