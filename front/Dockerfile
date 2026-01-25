# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Kopiuj package.json i lock file
COPY package*.json ./

# Instaluj zależności
RUN npm ci

# Kopiuj kod źródłowy
COPY . .

# Buduj aplikację produkcyjną
RUN npm run build

# Stage 2: Serve z NGINX
FROM nginx:alpine

# Usuń domyślną konfigurację
RUN rm /etc/nginx/conf.d/default.conf

# Kopiuj własną konfigurację NGINX dla SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Kopiuj zbudowaną aplikację
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -q --spider http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
