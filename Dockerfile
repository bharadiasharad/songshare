# syntax=docker/dockerfile:1

# ───────────────────────────────────────────────────────────────
# Stage 1: dependencies (incl. dev) + prisma client generation
# ───────────────────────────────────────────────────────────────
FROM node:20-slim AS deps
# OpenSSL is required by Prisma engines on slim images
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate

# ───────────────────────────────────────────────────────────────
# Stage 2: build the application
# ───────────────────────────────────────────────────────────────
FROM node:20-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ───────────────────────────────────────────────────────────────
# Stage 3: production runtime (slim, non-root)
# ───────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force

# Copy compiled output
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Create uploads dir and run as the built-in non-root `node` user
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
