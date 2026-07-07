# Build stage
FROM node:24.18.0-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY src/ ./src/
COPY drizzle/ ./drizzle/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:24.18.0-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]
