#docker-compose.yml

version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: ec_mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: aradmin!2723646
      MYSQL_DATABASE: ecacttrack
      MYSQL_ROOT_HOST: '%'
    command: --default-authentication-plugin=mysql_native_password
    ports:
      - "3307:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - ec_network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-paradmin!2723646"]
      timeout: 10s
      retries: 30
      interval: 5s
      start_period: 30s

  app:
    image: khristox/ec-action-tracker:latest
    container_name: ec_app
    restart: unless-stopped
    depends_on:
      mysql:
        condition: service_healthy
    user: root  # Add this line to run as root
    ports:
      - "8006:8001"
    volumes:
      - ./logs:/app/logs
    networks:
      - ec_network
    environment:
      DATABASE_URL: mysql+aiomysql://root:aradmin!2723646@mysql:3306/ecacttrack
      SECRET_KEY: anq7XxRv9Zado5dWbZSNmD2LOboeSKF1OpAN4g4TgTQ
      ALGORITHM: HS256
      ACCESS_TOKEN_EXPIRE_MINUTES: 120
      REFRESH_TOKEN_SECRET_KEY: XwgWnxCp9YpVJAYLrYICX7ia_mhcOm1RgStM63hHUKU
      REFRESH_TOKEN_EXPIRE_DAYS: 7
      ADMIN_USERNAME: admin
      ADMIN_PASSWORD: Admin123!
      ENVIRONMENT: production
      DEBUG: "false"
      IN_DOCKER: "true"
      FRONTEND_DIST_PATH:/app/static
      API_BASE_URL: http://localhost:8006
    command: >
      sh -c "
        pip install uvicorn &&
        python -m uvicorn app.main:app --host 0.0.0.0 --port 8001
      "

volumes:
  mysql_data:

networks:
  ec_network:
    driver: bridge



#seed.sh 
docker compose run --rm app python app/db/seed/seed_data.py

docker compose run --rm app python app/db/seed/seed_data.py http://127.0.0.1:8001 admin Admin123! --force


docker exec ec_app python app/db/seed/seed_data.py


docker exec -it ec_app /bin/sh
docker exec -it ec_app /bin/bash


docker compose run --rm app python app/db/seed/seed_data.py ec_app admin Admin123! --force


 docker build -t khristox/ec-action-tracker:latest .


docker exec -it --user root ec_app /bin/bash
sleep 20
apt-get update && apt-get install -y jq


docker compose run --rm app uvicorn app.main:app --reload --port 8001

docker compose run --rm app python app/db/seed/seed_data.py http://ec_app:8001 admin Admin123! --force



  docker compose pull app
  docker compose build --no-cache app --remove-orphans
  docker compose up -d --force-recreate --no-deps app
