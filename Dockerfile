# Stage 1: Build the Node.js application
FROM node:16-buster AS builder

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Grant execution permissions to PhotoRec
RUN chmod +x /app/tools/photorec_static

# Stage 2: Setup the application with necessary tools
FROM node:16-buster

# Set the working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app /app

# Install necessary tools and dependencies for PhotoRec
RUN apt-get update && \
    apt-get install -y procps python3 python3-pip build-essential \
    libncurses5 libncursesw5 && \
    apt-get clean

# Grant execution permissions to PhotoRec
RUN chmod +x /app/tools/photorec_static

# Expose ports
EXPOSE 55000

# Start the Node.js application as root
USER root
CMD ["node", "app.js"]
