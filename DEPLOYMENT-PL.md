# 🚀 Opcje Wdrożenia HomeBank Bridge

## 📋 Odpowiedź na pytanie o opcje wdrożenia

**TAK, aplikacja HomeBank Bridge MOŻE działać na zwykłym serwerze WWW z Node.js!**

Aplikacja **nie jest ograniczona tylko do deploymentu kontenerowego (Docker)**. Istnieją dwie główne opcje wdrożenia:

1. ✅ **Tradycyjny serwer WWW z Node.js** (VPS, serwer dedykowany)
2. ✅ **Deployment kontenerowy** (Docker, Coolify, Kubernetes)

---

## 🏗️ Architektura Aplikacji

HomeBank Bridge składa się z trzech głównych komponentów:

```
┌─────────────────────────────────────────┐
│  Frontend (React 19)                    │
│  └─ Kompiluje się do statycznych plików │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Backend API (Node.js + Express)        │
│  └─ Serwuje API i statyczne pliki       │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Baza Danych (SQLite)                   │
│  └─ Plik: backend/data/data.db          │
│  └─ Sesje: backend/data/sessions.db     │
└─────────────────────────────────────────┘
```

### Kluczowe cechy:
- **SQLite** = baza danych oparta na pliku (nie wymaga osobnego serwera DB)
- **Backend** = serwer Node.js nasłuchujący na porcie (domyślnie 3000)
- **Frontend** = statyczne pliki HTML/JS/CSS serwowane przez backend

---

## 🖥️ Opcja 1: Tradycyjny Serwer WWW

### Wymagania:
- **System operacyjny**: Linux (Ubuntu/Debian), macOS, lub Windows Server
- **Node.js**: wersja 18 lub nowsza
- **npm**: menedżer pakietów Node.js
- **Dostęp do systemu plików**: do zapisu bazy danych SQLite
- **Port**: 3000 (lub inny według wyboru)
- **Pamięć RAM**: minimum 512 MB (zalecane 1 GB)
- **Miejsce na dysku**: minimum 500 MB

### Instrukcja wdrożenia krok po kroku:

#### 1. Przygotowanie serwera

```bash
# Zaktualizuj system (Ubuntu/Debian)
sudo apt update && sudo apt upgrade -y

# Zainstaluj Node.js 18+ (poprzez NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Sprawdź wersje
node --version  # Powinno być v18.x.x lub wyższe
npm --version
```

#### 2. Sklonowanie i konfiguracja projektu

```bash
# Przejdź do katalogu aplikacji
cd /var/www  # lub inny katalog wyboru

# Sklonuj repozytorium
git clone https://github.com/MarynarzSwiata/HomeBank-Bridge.git
cd HomeBank-Bridge

# Zainstaluj zależności dla root projektu
npm install

# Zainstaluj zależności dla backendu
cd backend
npm install
cd ..
```

#### 3. Konfiguracja środowiska

```bash
# Skopiuj przykładowy plik konfiguracji
cp .env.example .env

# Edytuj plik .env
nano .env
```

Ustaw następujące zmienne środowiskowe:

```bash
# Backend
PORT=3000
NODE_ENV=production
FRONTEND_URL=http://twoja-domena.pl  # lub http://adres-ip:3000

# Autentykacja (WAŻNE: zmień na własny sekret!)
SESSION_SECRET=twoj-bardzo-bezpieczny-sekret-minimum-32-znaki
ALLOW_REGISTRATION=false  # true jeśli chcesz pozwolić na rejestrację

# Frontend (nie używane w produkcji - frontend jest wbudowany)
# VITE_API_URL=http://localhost:3000/api
```

#### 4. Budowanie aplikacji

```bash
# Zbuduj frontend (kompilacja do statycznych plików)
npm run build

# Pliki zostaną wygenerowane w katalogu ./dist
```

#### 5. Przygotowanie struktury produkcyjnej

```bash
# Utwórz katalog na dane (baza danych SQLite)
mkdir -p backend/data

# Ustaw odpowiednie uprawnienia
chmod 755 backend/data
```

#### 6. Uruchomienie aplikacji

**Opcja A: Bezpośrednio (do testów)**
```bash
cd backend
NODE_ENV=production node server.js
```

**Opcja B: Z PM2 (zalecane dla produkcji)**
```bash
# Zainstaluj PM2 globalnie
sudo npm install -g pm2

# Uruchom aplikację z PM2
cd backend
pm2 start server.js --name homebank-bridge --node-args="--max-old-space-size=512"

# Zapisz konfigurację PM2
pm2 save

# Ustaw autostart przy restarcie serwera
pm2 startup
# Wykonaj polecenie, które PM2 wyświetli
```

**Opcja C: Z systemd (serwis systemowy)**

Utwórz plik serwisu:
```bash
sudo nano /etc/systemd/system/homebank-bridge.service
```

Zawartość pliku:
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
Environment="SESSION_SECRET=twoj-sekret-tutaj"
Environment="FRONTEND_URL=http://twoja-domena.pl"
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Uruchom serwis:
```bash
sudo systemctl daemon-reload
sudo systemctl enable homebank-bridge
sudo systemctl start homebank-bridge
sudo systemctl status homebank-bridge
```

#### 7. Konfiguracja reverse proxy (opcjonalne, ale zalecane)

**Nginx:**
```nginx
server {
    listen 80;
    server_name twoja-domena.pl;

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
    ServerName twoja-domena.pl
    
    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
    
    <Location />
        Require all granted
    </Location>
</VirtualHost>
```

#### 8. SSL/HTTPS (zalecane dla produkcji)

```bash
# Zainstaluj Certbot (Let's Encrypt)
sudo apt install certbot python3-certbot-nginx

# Uzyskaj certyfikat SSL
sudo certbot --nginx -d twoja-domena.pl
```

### Zarządzanie aplikacją na tradycyjnym serwerze:

**Z PM2:**
```bash
# Status aplikacji
pm2 status

# Logi w czasie rzeczywistym
pm2 logs homebank-bridge

# Restart
pm2 restart homebank-bridge

# Stop
pm2 stop homebank-bridge

# Monitorowanie
pm2 monit
```

**Z systemd:**
```bash
# Status
sudo systemctl status homebank-bridge

# Logi
sudo journalctl -u homebank-bridge -f

# Restart
sudo systemctl restart homebank-bridge

# Stop
sudo systemctl stop homebank-bridge
```

### Aktualizacja aplikacji:

```bash
# Zatrzymaj aplikację
pm2 stop homebank-bridge  # lub: sudo systemctl stop homebank-bridge

# Pobierz najnowszą wersję
git pull origin main

# Zainstaluj nowe zależności (jeśli są)
npm install
cd backend && npm install && cd ..

# Przebuduj frontend
npm run build

# Uruchom ponownie
pm2 restart homebank-bridge  # lub: sudo systemctl start homebank-bridge
```

---

## 🐳 Opcja 2: Deployment Kontenerowy (Docker)

### Wymagania:
- **Docker**: wersja 20.10 lub nowsza
- **Docker Compose**: (opcjonalnie, dla łatwiejszego zarządzania)

### Instrukcja wdrożenia:

#### 1. Przygotowanie

```bash
# Zainstaluj Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Dodaj użytkownika do grupy docker
sudo usermod -aG docker $USER
newgrp docker
```

#### 2. Budowanie obrazu

```bash
# Sklonuj repozytorium
git clone https://github.com/MarynarzSwiata/HomeBank-Bridge.git
cd HomeBank-Bridge

# Zbuduj obraz Docker
docker build -t homebank-bridge:latest .
```

#### 3. Uruchomienie kontenera

```bash
# Utwórz katalog na dane (poza kontenerem)
mkdir -p ./hb-data

# Uruchom kontener
docker run -d \
  --name homebank-bridge \
  -p 3000:3000 \
  -v $(pwd)/hb-data:/app/backend/data \
  -e SESSION_SECRET="twoj-bezpieczny-sekret-min-32-znaki" \
  -e FRONTEND_URL="http://twoja-domena.pl" \
  -e ALLOW_REGISTRATION="false" \
  --restart unless-stopped \
  homebank-bridge:latest
```

#### 4. Docker Compose (zalecane)

Utwórz plik `docker-compose.yml`:

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
      - SESSION_SECRET=twoj-bezpieczny-sekret-minimum-32-znaki
      - FRONTEND_URL=http://twoja-domena.pl
      - ALLOW_REGISTRATION=false
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 5s
```

Uruchom:
```bash
docker-compose up -d
```

### Zarządzanie kontenerem:

```bash
# Status
docker ps

# Logi
docker logs -f homebank-bridge

# Restart
docker restart homebank-bridge

# Stop
docker stop homebank-bridge

# Usuń kontener
docker rm homebank-bridge
```

---

## 📊 Porównanie Opcji Wdrożenia

| Kryterium | Tradycyjny Serwer | Docker |
|-----------|-------------------|---------|
| **Łatwość instalacji** | Średnia (więcej kroków) | Łatwa (jeden obraz) |
| **Izolacja** | Brak (współdzieli system) | Pełna (kontener) |
| **Wydajność** | Nieco lepsza (native) | Bardzo dobra (minimalne overhead) |
| **Aktualizacje** | Manualne (git pull + rebuild) | Łatwe (pull image) |
| **Zużycie zasobów** | Mniejsze (bezpośrednio na systemie) | Nieco większe (warstwa Docker) |
| **Przenośność** | Zależna od systemu | Pełna (działa wszędzie) |
| **Backup** | Kopiuj katalog data/ | Kopiuj wolumen + obraz |
| **Skalowalność** | Ograniczona | Łatwa (orchestracja) |
| **Bezpieczeństwo** | Zależy od konfiguracji serwera | Większa izolacja |
| **Zalecane dla** | VPS, serwery dedykowane | Wszystkie środowiska |

---

## 💾 Baza Danych SQLite - Ważne informacje

### Jak działa?

SQLite to **baza danych oparta na pliku**. Nie wymaga osobnego serwera bazy danych (jak MySQL czy PostgreSQL). Wszystkie dane są przechowywane w plikach:

```
backend/data/
├── data.db           # Główna baza danych aplikacji
├── data.db-shm       # Shared memory file (tymczasowy)
├── data.db-wal       # Write-Ahead Log
└── sessions.db       # Baza sesji użytkowników
```

### Zalety SQLite dla tego projektu:
- ✅ Brak potrzeby instalacji i konfiguracji serwera bazy danych
- ✅ Zero maintenance - nie trzeba zarządzać procesem DB
- ✅ Świetna wydajność dla małych/średnich aplikacji
- ✅ Atomowe transakcje i pełna integralność danych
- ✅ Łatwy backup (kopiuj plik .db)

### Ograniczenia:
- ⚠️ Nie nadaje się do wielkich obciążeń (tysięce równoczesnych użytkowników)
- ⚠️ Jeden proces zapisu jednocześnie (ale wiele odczytów)
- ⚠️ Sieciowy dostęp tylko przez backend API (brak bezpośredniego połączenia)

### Backup bazy danych:

```bash
# Tradycyjny serwer
cd /var/www/HomeBank-Bridge/backend
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# Docker
docker exec homebank-bridge tar -czf /tmp/backup.tar.gz /app/backend/data
docker cp homebank-bridge:/tmp/backup.tar.gz ./backup-$(date +%Y%m%d).tar.gz
```

---

## 🔧 Migracja między opcjami

### Z tradycyjnego serwera do Dockera:

```bash
# 1. Zrób backup bazy danych
cd /var/www/HomeBank-Bridge/backend
cp -r data/ ~/homebank-backup/

# 2. Zbuduj obraz Docker
cd /var/www/HomeBank-Bridge
docker build -t homebank-bridge .

# 3. Uruchom z wolumenem wskazującym na backup
docker run -d \
  -p 3000:3000 \
  -v ~/homebank-backup:/app/backend/data \
  -e SESSION_SECRET="twoj-sekret" \
  homebank-bridge
```

### Z Dockera do tradycyjnego serwera:

```bash
# 1. Skopiuj dane z kontenera
docker cp homebank-bridge:/app/backend/data ./data-backup

# 2. Zainstaluj aplikację tradycyjnie (patrz sekcja wyżej)

# 3. Skopiuj bazę danych
cp -r ./data-backup/* /var/www/HomeBank-Bridge/backend/data/

# 4. Uruchom aplikację
pm2 start server.js --name homebank-bridge
```

---

## 🎯 Rekomendacje

### Dla pojedynczego użytkownika / rodziny:
- ✅ **Tradycyjny serwer** - prostszy, mniej warstw
- VPS z 1GB RAM wystarczy
- PM2 do zarządzania procesem
- Nginx jako reverse proxy

### Dla małego zespołu / firmy:
- ✅ **Docker** - łatwiejsze aktualizacje i backup
- Docker Compose dla wygody
- Możliwość łatwej migracji

### Dla środowiska produkcyjnego:
- ✅ **Docker + Coolify** (jak w dokumentacji)
- Automatyczne deploymenty
- Monitoring i logi
- SSL out-of-the-box

---

## ❓ Najczęściej Zadawane Pytania

### 1. Czy muszę mieć MySQL/PostgreSQL?
**Nie!** SQLite jest wbudowane. Nie potrzebujesz osobnego serwera bazy danych.

### 2. Czy mogę uruchomić to na shared hostingu?
**Raczej nie.** Potrzebujesz:
- Dostępu SSH
- Możliwości instalacji Node.js
- Możliwości uruchamiania własnych procesów
- Dostępu do portów

Typowy shared hosting PHP nie wystarczy. Potrzebujesz VPS lub serwera dedykowanego.

### 3. Ile zasobów potrzebuje aplikacja?
- **RAM**: 512 MB - 1 GB (zalecane 1 GB)
- **CPU**: 1 vCore wystarczy
- **Dysk**: 1-2 GB (w zależności od ilości danych)
- **Przepustowość**: minimalna

### 4. Czy baza danych jest bezpieczna?
Tak, pod warunkiem:
- ✅ Katalog `backend/data/` jest niedostępny przez web
- ✅ Masz backupy
- ✅ Regularne aktualizacje systemu
- ✅ Silny SESSION_SECRET

### 5. Jak często robić backup?
- **Codziennie** dla produkcji
- **Co tydzień** dla użytku osobistego
- **Automatyczne backupy** zalecane

### 6. Czy mogę użyć PostgreSQL zamiast SQLite?
Obecnie aplikacja jest zaprojektowana dla SQLite. Migracja do PostgreSQL wymagałaby modyfikacji kodu backendu.

---

## 📞 Wsparcie

- **GitHub Issues**: https://github.com/MarynarzSwiata/HomeBank-Bridge/issues
- **Dokumentacja**: README.md w repozytorium

---

## ✅ Podsumowanie

**HomeBank Bridge może działać na zwykłym serwerze WWW!**

Masz do wyboru:
1. **Tradycyjny serwer z Node.js** - pełna kontrola, direct installation
2. **Docker deployment** - łatwiejsze zarządzanie, lepsza przenośność

Oba podejścia są w pełni wspierane i działają z bazą danych SQLite, która nie wymaga osobnego serwera bazy danych.

Wybór zależy od Twoich preferencji, umiejętności i infrastruktury.
