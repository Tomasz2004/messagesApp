# Stage 1: Build
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app

# Kopiuj pliki Maven
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .

# Pobierz zależności (cache'owanie)
RUN chmod +x mvnw && ./mvnw dependency:go-offline -B

# Kopiuj kod źródłowy
COPY src src

# Buduj aplikację (skip tests dla szybszego buildu)
RUN ./mvnw package -DskipTests -B

# Stage 2: Runtime
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Utwórz użytkownika non-root (bezpieczeństwo)
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Kopiuj JAR z etapu build
COPY --from=builder /app/target/*.jar app.jar

# Zmień właściciela
RUN chown -R appuser:appgroup /app

USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
    CMD wget -q --spider http://localhost:8080/api/users || exit 1

# Uruchom aplikację
ENTRYPOINT ["java", "-jar", "app.jar"]
