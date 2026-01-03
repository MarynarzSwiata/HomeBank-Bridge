# ==========================================
# Phase 1: Build Frontend (Vite)
# ==========================================
FROM node:18-alpine AS frontend-builder

# Arguments for build-time configuration
ARG FRONTEND_URL
ARG ALLOW_REGISTRATION=true

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
# Frontend build will use process.env during Vite build if configured
RUN npm run build

# ==========================================
# Phase 2: Production Server (Node.js)
# ==========================================
FROM node:18-alpine
WORKDIR /app

# Install only production dependencies for backend
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --production

# Copy backend source code
COPY backend/ ./

# Copy pre-built frontend from Phase 1 to backend/public
COPY --from=frontend-builder /app/dist ./public

# Ensure directory for persistent SQLite data exists
RUN mkdir -p data && apk add --no-cache curl

# Production Environment Settings
ENV NODE_ENV=production
ENV PORT=3000

# Default port exposed by the container
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Run migrations and start the server
# We use node directly. Migrations are handled by the app on startup.
CMD ["node", "server.js"]
