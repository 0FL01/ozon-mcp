# ------------------------------
# Base
# ------------------------------
# Base stage: Contains only the minimal dependencies required for runtime
FROM node:22-bookworm-slim AS base

# Set the working directory
WORKDIR /app

# Install production dependencies
RUN --mount=type=cache,target=/root/.npm,sharing=locked,id=npm-cache \
    --mount=type=bind,source=server/package.json,target=package.json \
    --mount=type=bind,source=server/package-lock.json,target=package-lock.json \
  npm ci --omit=dev

# ------------------------------
# Builder
# ------------------------------
FROM base AS builder

# Install all dependencies (including dev dependencies for build)
RUN --mount=type=cache,target=/root/.npm,sharing=locked,id=npm-cache \
    --mount=type=bind,source=server/package.json,target=package.json \
    --mount=type=bind,source=server/package-lock.json,target=package-lock.json \
  npm ci

# Copy server source files
COPY server/*.json server/*.js ./

# ------------------------------
# Runtime
# ------------------------------
FROM base

ARG USERNAME=node
ENV NODE_ENV=production

# Set the correct ownership for the runtime user on production node_modules
RUN chown -R ${USERNAME}:${USERNAME} node_modules

USER ${USERNAME}

# Copy application files from server directory
COPY --chown=${USERNAME}:${USERNAME} server/cli.js server/package.json ./
COPY --chown=${USERNAME}:${USERNAME} server/src ./src

# Run the MCP server
ENTRYPOINT ["node", "cli.js"]
