#!/bin/bash

# Skrypt generujący self-signed certyfikat SSL dla lokalnego developmentu
# Użycie: ./generate-certs.sh

CERTS_DIR="./nginx/certs"
DAYS_VALID=365

echo "🔐 Generowanie certyfikatu SSL dla localhost..."

# Utwórz katalog na certyfikaty
mkdir -p "$CERTS_DIR"

# Wyłącz konwersję ścieżek w Git Bash (Windows)
export MSYS_NO_PATHCONV=1

# Generuj klucz prywatny i certyfikat
openssl req -x509 -nodes -days $DAYS_VALID -newkey rsa:2048 \
    -keyout "$CERTS_DIR/server.key" \
    -out "$CERTS_DIR/server.crt" \
    -subj "/C=PL/ST=Mazowieckie/L=Warszawa/O=SecureMessages/OU=Dev/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

# Ustaw odpowiednie uprawnienia
chmod 600 "$CERTS_DIR/server.key"
chmod 644 "$CERTS_DIR/server.crt"

echo ""
echo "✅ Certyfikaty wygenerowane pomyślnie!"
echo "   - Klucz prywatny: $CERTS_DIR/server.key"
echo "   - Certyfikat:     $CERTS_DIR/server.crt"
echo ""
echo "⚠️  UWAGA: To jest self-signed certyfikat dla lokalnego developmentu."
echo "   Przeglądarka pokaże ostrzeżenie - kliknij 'Zaawansowane' -> 'Przejdź do localhost'"
echo ""
echo "🚀 Teraz możesz uruchomić: docker-compose up --build"