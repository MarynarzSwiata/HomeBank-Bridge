# Odpowiedź na pytanie: Czy aplikacja może działać na zwykłym serwerze WWW?

## ✅ KRÓTKA ODPOWIEDŹ: TAK!

**HomeBank Bridge MOŻE działać na zwykłym serwerze WWW z Node.js.**

Aplikacja **NIE** jest ograniczona tylko do deploymentu kontenerowego (Docker).

---

## 🎯 Kluczowe Fakty

### Baza Danych
- ✅ Używa **SQLite** - baza danych oparta na pliku
- ✅ **NIE potrzebujesz** osobnego serwera bazy danych (MySQL, PostgreSQL, itp.)
- ✅ Wszystkie dane są zapisywane w plikach: `backend/data/data.db` i `backend/data/sessions.db`

### Wymagania Serwera
- ✅ **Node.js** w wersji 18 lub nowszej
- ✅ **Port** do nasłuchiwania (domyślnie 3000)
- ✅ **Dostęp do systemu plików** - do zapisu plików bazy danych
- ✅ **512 MB - 1 GB RAM** (zalecane 1 GB)

### Opcje Wdrożenia
Masz **2 główne opcje**:

1. **Tradycyjny serwer WWW** (VPS, serwer dedykowany)
   - Bezpośrednia instalacja Node.js
   - Uruchamianie aplikacji przez PM2 lub systemd
   - Pełna kontrola nad środowiskiem

2. **Deployment kontenerowy** (Docker)
   - Łatwiejsze zarządzanie
   - Lepsza przenośność
   - Automatyczne aktualizacje

---

## 📚 Szczegółowa Dokumentacja

Dla pełnych instrukcji wdrożenia, zobacz:

- 🇵🇱 **[DEPLOYMENT-PL.md](DEPLOYMENT-PL.md)** - Kompletny przewodnik po polsku
  - Instalacja krok po kroku na tradycyjnym serwerze
  - Instrukcje Docker deployment
  - Konfiguracja PM2, systemd, Nginx, Apache
  - Backup i aktualizacje
  - FAQ i rozwiązywanie problemów

- 🇬🇧 **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete guide in English

---

## 🚀 Szybki Start: Tradycyjny Serwer

```bash
# 1. Zainstaluj Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Sklonuj repozytorium
git clone https://github.com/MarynarzSwiata/HomeBank-Bridge.git
cd HomeBank-Bridge

# 3. Zainstaluj zależności
npm install
cd backend && npm install && cd ..

# 4. Skonfiguruj środowisko
cp .env.example .env
nano .env  # Ustaw SESSION_SECRET i inne zmienne

# 5. Zbuduj aplikację
npm run build

# 6. Uruchom z PM2
cd backend
npm install -g pm2
pm2 start server.js --name homebank-bridge
pm2 save
```

**Aplikacja będzie działać na porcie 3000!**

---

## 🐳 Szybki Start: Docker

```bash
# 1. Sklonuj repozytorium
git clone https://github.com/MarynarzSwiata/HomeBank-Bridge.git
cd HomeBank-Bridge

# 2. Zbuduj obraz
docker build -t homebank-bridge .

# 3. Uruchom kontener
mkdir -p ./hb-data
docker run -d \
  --name homebank-bridge \
  -p 3000:3000 \
  -v $(pwd)/hb-data:/app/backend/data \
  -e SESSION_SECRET="twoj-bezpieczny-sekret" \
  -e FRONTEND_URL="http://twoja-domena.pl" \
  --restart unless-stopped \
  homebank-bridge
```

**Aplikacja będzie działać na porcie 3000!**

---

## 📊 Porównanie Opcji

| Kryterium | Tradycyjny Serwer | Docker |
|-----------|-------------------|---------|
| Łatwość instalacji | Średnia | Łatwa |
| Wymagania | Node.js na serwerze | Docker |
| Baza danych | SQLite (plik) | SQLite (plik) |
| Wydajność | Nieco lepsza | Bardzo dobra |
| Aktualizacje | Manualne | Łatwe |
| Izolacja | Brak | Pełna |
| Zalecane dla | VPS, serwery dedykowane | Wszystkie środowiska |

---

## ❓ Najczęstsze Pytania

### Czy potrzebuję MySQL lub PostgreSQL?
**NIE!** SQLite jest wbudowane w aplikację. Nie potrzebujesz osobnego serwera bazy danych.

### Czy mogę to uruchomić na shared hostingu?
**Prawdopodobnie nie.** Potrzebujesz:
- Dostępu SSH
- Możliwości instalacji Node.js
- Możliwości uruchamiania własnych procesów
- Dostępu do portów

Typowy shared hosting PHP nie wystarczy. Potrzebujesz VPS lub serwera dedykowanego.

### Ile zasobów potrzebuje aplikacja?
- **RAM**: 512 MB - 1 GB (zalecane 1 GB)
- **CPU**: 1 vCore wystarczy
- **Dysk**: 1-2 GB (w zależności od ilości danych)
- **Przepustowość**: minimalna

### Czy to bezpieczne?
Tak, pod warunkiem:
- ✅ Silny SESSION_SECRET
- ✅ Regularne backupy
- ✅ Aktualizacje systemu
- ✅ Katalog `backend/data/` jest niedostępny przez web

---

## 🎓 Podsumowanie

**Aplikacja HomeBank Bridge:**
- ✅ **MOŻE** działać na zwykłym serwerze WWW z Node.js
- ✅ **NIE wymaga** osobnego serwera bazy danych
- ✅ **Używa SQLite** - bazy danych opartej na pliku
- ✅ **Obsługuje** zarówno tradycyjne wdrożenie jak i Docker

**Wybór metody wdrożenia zależy od Twoich preferencji i infrastruktury.**

Dla pełnych instrukcji, zobacz **[DEPLOYMENT-PL.md](DEPLOYMENT-PL.md)**!
