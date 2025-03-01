#!/bin/bash

# Combined script to set up Lonely Panel and Lonely Wings in Docker containers without systemd or Docker on the host.

# Variables for Panel
PANEL_NAME="lonely-panel"
DB_PASSWORD="yourpassword"
ROOT_DB_PASSWORD="yourrootpassword"
APP_URL="http://localhost:8000"
ADMIN_EMAIL="admin@example.com"
ADMIN_USERNAME="admin"
ADMIN_NAME="Admin"
ADMIN_PASSWORD="password"

# Variables for Wings
WINGS_NAME="lonely-wings"
PANEL_URL="http://localhost:8000"  # Replace with your Lonely Panel URL
NODE_NAME="Lonely Node"                 # Name of the node to be created
NODE_DESCRIPTION="Auto-created node"    # Description for the node
NODE_LOCATION="1"                       # Location ID for the node (default: 1)

# Step 1: Clone the Pterodactyl Panel repository
echo "Cloning Pterodactyl Panel repository..."
git clone https://github.com/pterodactyl/panel.git $PANEL_NAME
cd $PANEL_NAME

# Step 2: Replace "Pterodactyl" with "Lonely"
echo "Renaming Pterodactyl to Lonely..."
find . -type f -exec sed -i 's/Pterodactyl/Lonely/g' {} +

# Step 3: Change Panel Color to Black
echo "Changing panel color to black..."
sed -i 's/#f7fafc/#000000/g' resources/assets/sass/app.scss
sed -i 's/#ffffff/#000000/g' resources/assets/sass/app.scss
sed -i 's/#e2e8f0/#000000/g' resources/assets/sass/app.scss

# Step 4: Create Dockerfile for Panel
echo "Creating Dockerfile for Panel..."
cat <<EOL > Dockerfile
FROM php:8.1-fpm

# Install dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip \
    libzip-dev \
    mariadb-client \
    && docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd zip

# Install Composer
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# Copy application files
COPY . /app
WORKDIR /app

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader

# Set permissions
RUN chown -R www-data:www-data /app/storage /app/bootstrap/cache
EOL

# Step 5: Create docker-compose.yml for Panel
echo "Creating docker-compose.yml for Panel..."
cat <<EOL > docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    container_name: $PANEL_NAME-app
    restart: unless-stopped
    environment:
      DB_HOST: db
      DB_PORT: 3306
      DB_DATABASE: $PANEL_NAME
      DB_USERNAME: $PANEL_NAME
      DB_PASSWORD: $DB_PASSWORD
      REDIS_HOST: redis
      APP_URL: $APP_URL
      APP_ENV: production
    volumes:
      - ./var:/app/var
    depends_on:
      - db
      - redis

  db:
    image: mariadb:10.6
    container_name: $PANEL_NAME-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: $ROOT_DB_PASSWORD
      MYSQL_DATABASE: $PANEL_NAME
      MYSQL_USER: $PANEL_NAME
      MYSQL_PASSWORD: $DB_PASSWORD
    volumes:
      - ./data/mysql:/var/lib/mysql

  redis:
    image: redis:alpine
    container_name: $PANEL_NAME-redis
    restart: unless-stopped
    volumes:
      - ./data/redis:/data

  queue:
    build: .
    container_name: $PANEL_NAME-queue
    restart: unless-stopped
    command: php /app/artisan queue:work
    depends_on:
      - app
      - redis

  webserver:
    image: nginx:alpine
    container_name: $PANEL_NAME-webserver
    restart: unless-stopped
    ports:
      - "8000:80"
    volumes:
      - ./public:/app/public
    depends_on:
      - app
EOL

# Step 6: Build and run the Docker containers for Panel
echo "Building Docker containers for Panel..."
docker-compose build

echo "Starting Docker containers for Panel..."
docker-compose up -d

# Step 7: Run the installation command for Panel
echo "Running installation script for Panel..."
docker exec -it $PANEL_NAME-app php artisan p:install --no-interaction --email=$ADMIN_EMAIL --username=$ADMIN_USERNAME --name="$ADMIN_NAME" --password=$ADMIN_PASSWORD

# Step 8: Clone the Pterodactyl Wings repository
echo "Cloning Pterodactyl Wings repository..."
cd ..
git clone https://github.com/pterodactyl/wings.git $WINGS_NAME
cd $WINGS_NAME

# Step 9: Replace "Pterodactyl" with "Lonely" in Wings
echo "Renaming Pterodactyl to Lonely in Wings..."
find . -type f -exec sed -i 's/Pterodactyl/Lonely/g' {} +

# Step 10: Create Dockerfile for Wings
echo "Creating Dockerfile for Wings..."
cat <<EOL > Dockerfile
FROM golang:1.20-alpine AS builder

# Install dependencies
RUN apk add --no-cache \
    git \
    make \
    gcc \
    musl-dev

# Copy application files
COPY . /app
WORKDIR /app

# Build Wings
RUN go build -o wings

# Final image
FROM alpine:latest

# Install dependencies
RUN apk add --no-cache \
    docker \
    tini

# Copy built binary
COPY --from=builder /app/wings /usr/local/bin/wings

# Set up directories
RUN mkdir -p /etc/lonely /var/lib/lonely /var/log/lonely
VOLUME /etc/lonely /var/lib/lonely /var/log/lonely

# Set up entrypoint
ENTRYPOINT ["/sbin/tini", "--", "wings"]
CMD ["--config", "/etc/lonely/config.yml"]
EOL

# Step 11: Create docker-compose.yml for Wings
echo "Creating docker-compose.yml for Wings..."
cat <<EOL > docker-compose.yml
version: '3.8'

services:
  wings:
    build: .
    container_name: $WINGS_NAME
    restart: unless-stopped
    environment:
      PANEL_URL: $PANEL_URL
      API_KEY: $API_KEY
    volumes:
      - ./config:/etc/lonely
      - ./data:/var/lib/lonely
      - ./logs:/var/log/lonely
      - /var/run/docker.sock:/var/run/docker.sock
    ports:
      - "8080:8080"
EOL

# Step 12: Generate an API key from the Lonely Panel
echo "Generating API key from Lonely Panel..."
API_KEY=$(curl -s -X POST "$PANEL_URL/api/application/users" \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASSWORD\"}" | jq -r '.attributes.api_key')

if [ -z "$API_KEY" ]; then
    echo "Failed to generate API key. Please check your Lonely Panel credentials."
    exit 1
fi

# Step 13: Create a node via the Lonely Panel API
echo "Creating node in Lonely Panel..."
NODE_RESPONSE=$(curl -s -X POST "$PANEL_URL/api/application/nodes" \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_KEY" \
    -d "{
        \"name\": \"$NODE_NAME\",
        \"description\": \"$NODE_DESCRIPTION\",
        \"location_id\": $NODE_LOCATION,
        \"public\": true,
        \"fqdn\": \"$(hostname -I | awk '{print $1}')\",
        \"scheme\": \"http\",
        \"behind_proxy\": false,
        \"memory\": 1024,
        \"memory_overallocate\": 0,
        \"disk\": 5000,
        \"disk_overallocate\": 0,
        \"daemon_base\": \"/var/lib/lonely\",
        \"daemon_sftp\": 2022,
        \"daemon_listen\": 8080
    }")

NODE_ID=$(echo "$NODE_RESPONSE" | jq -r '.attributes.id')

if [ -z "$NODE_ID" ]; then
    echo "Failed to create node. Please check your Lonely Panel API settings."
    exit 1
fi

# Step 14: Configure Wings to use the newly created node
echo "Configuring Wings to use the new node..."
cat <<EOL > config/config.yml
panel:
  url: $PANEL_URL
  key: $API_KEY
  node: $NODE_ID
system:
  data: /var/lib/lonely
  sftp:
    bind_port: 2022
docker:
  socket: /var/run/docker.sock
EOL

# Step 15: Build and run the Docker containers for Wings
echo "Building Docker containers for Wings..."
docker-compose build

echo "Starting Docker containers for Wings..."
docker-compose up -d

# Step 16: Restart Wings to apply the new configuration
echo "Restarting Wings..."
docker-compose restart wings

# Step 17: Display completion message
echo "Lonely Panel and Wings setup complete!"
echo "Access the panel at $APP_URL"
echo "Default admin credentials:"
echo "Email: $ADMIN_EMAIL"
echo "Password: $ADMIN_PASSWORD"
echo "Node '$NODE_NAME' has been added to your Lonely Panel."
echo "Wings is now running and connected to your Lonely Panel."
echo "You can access Wings logs by running: docker logs $WINGS_NAME"
