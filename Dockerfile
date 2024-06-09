# Stage 1: Build the Node.js application
FROM node:16-buster AS builder

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Grant execution permissions to PhotoRec in the builder stage
RUN chmod +x /app/tools/photorec_static

# Stage 2: Setup Nginx and the application
FROM nginx:latest

# Set the working directory
WORKDIR /app

# Copy Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built application from builder stage
COPY --from=builder /app /app

# Install necessary tools
RUN apt-get update && apt-get install -y procps && apt-get clean

# Ensure permissions are set correctly
USER root
RUN chmod +x /app/tools/photorec_static

# Set non-root user
USER nginx

# Expose ports
EXPOSE 80

# Start Nginx server
CMD ["nginx", "-g", "daemon off;"]
