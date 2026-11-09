# ============================================================
# FitCore - registration-service (production image)
# ============================================================

# ---------- Stage 1: install dependencies ----------

# Use the official Node.js 22 LTS image on Alpine Linux (small and secure)
FROM node:22-alpine AS deps

# Set the working directory inside the build container
WORKDIR /app

# Copy only the package files first, so Docker caches the npm install layer
COPY package.json package-lock.json ./

# Install the exact versions from package-lock.json, without dev dependencies
RUN npm ci --omit=dev && npm cache clean --force

# ---------- Stage 2: production runtime ----------

# Start again from a clean Node.js 22 Alpine image (no build leftovers)
FROM node:22-alpine AS runtime

# Describe the image
LABEL org.opencontainers.image.title="fitcore-registration-service" \
      org.opencontainers.image.description="Member sign-up and admin user management" \
      org.opencontainers.image.version="1.0.0"

# Run Node.js in production mode
ENV NODE_ENV=production

# Set the working directory inside the container
WORKDIR /app

# Copy the installed dependencies from stage 1, owned by the non-root "node" user
COPY --from=deps --chown=node:node /app/node_modules ./node_modules

# Copy the package file and the application source code
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

# Run as the unprivileged "node" user instead of root
USER node

# Document the port this service listens on
EXPOSE 8001

# Let Docker check the service every 15 seconds through its /health endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" > /dev/null || exit 1

# Start the service
CMD ["node", "src/server.js"]
