# ==========================================
# Stage 1: Build Frontend
# ==========================================
FROM node:18-alpine AS frontend-builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ==========================================
# Stage 2: Runtime Environment
# ==========================================
FROM node:18-alpine
WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --production

# Copy backend source code
COPY backend/ ./

# Copy built frontend assets from Stage 1 to backend/public
COPY --from=frontend-builder /app/dist ./public

# Create directory for persistent data
RUN mkdir -p data

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
