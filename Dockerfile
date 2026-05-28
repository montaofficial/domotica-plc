# --- Frontend build stage ---
FROM node:22-alpine AS frontend-builder

WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build


# --- Production stage ---
FROM node:22-alpine AS production

# Build deps for native modules (better-sqlite3), removed after npm ci.
RUN apk add --no-cache --virtual .build-deps python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && apk del .build-deps

COPY server/ ./server/
COPY --from=frontend-builder /app/client/dist ./client/dist

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/health || exit 1

# Run as non-root user.
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app
USER nodejs

CMD ["node", "server/index.js"]
