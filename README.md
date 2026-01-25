## 🚀 Uruchomienie projektu

### Wymagania:

- Docker i Docker Compose

### Kroki:

```bash
# 1. Sklonuj repozytorium
git clone https://github.com/twoj-username/messages.git
cd messages

# 2. Skopiuj plik konfiguracyjny
cp .env.example .env

# 3. (Opcjonalnie) Edytuj .env i zmień hasła

# 4. Wygeneruj certyfikaty SSL
chmod +x generate-certs.sh
./generate-certs.sh

# 5. Uruchom aplikację
docker-compose up --build

# 6. Otwórz https://localhost w przeglądarce
#    (zaakceptuj ostrzeżenie o certyfikacie)
```

### Domyślne dane logowania do bazy:

- Host: `localhost:5432`
- Baza: `messagesDB`
- User: `admin`
- Password: `admin`

(można zmienić w pliku `.env`)
