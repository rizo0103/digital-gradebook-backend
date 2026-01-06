# Use official Node.js LTS image
FROM node:20-slim

# Set working directory
WORKDIR /usr/src/app

# Install build tools (optional, only if native modules are needed)
# RUN apt-get update && apt-get install -y build-essential python3 make g++

# Copy dependency manifests first for caching
COPY package*.json ./

# Install dependencies (production only)
RUN npm install --omit=dev

# Copy app source
COPY . .

# Expose port (match your Node.js server)
EXPOSE 3000

# Start the app
CMD ["node", "server.js"]
