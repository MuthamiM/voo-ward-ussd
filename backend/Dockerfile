# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=18.19.1
FROM node:${NODE_VERSION}-slim as base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Install packages needed to build node modules
FROM base as build

# Copy package files
COPY backend/package*.json ./
# Install dependencies
RUN npm ci --include=dev

# Copy application code
COPY backend/ .

# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app /app

# Expose port
EXPOSE 8080

# Start the server
CMD [ "npm", "start" ]
