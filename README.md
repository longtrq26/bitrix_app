# Getting Started

Follow these steps to get the project up and running on your local machine.

---

## 1. Clone the Repository

```bash

git clone <repository-url>
cd <project-directory>
```

---

## 2. Server Setup (NestJS)

Navigate to the server directory, install dependencies, and set up the environment.

```bash

cd server
npm install # or yarn install
```

### Environment Variables

Create a `.env` file in the `server/` directory:

```env
# server/.env

PORT=3000
DB_HOST=<your-db-host>
DB_PORT=5432
DB_USER=<your-db-username>
DB_PASSWORD=<your-db-password>
DB_NAME=<your-db-name>
REDIS_HOST=redis
REDIS_PORT=6379
BITRIX24_CLIENT_ID=<your-bitrix24-client-id>
BITRIX24_CLIENT_SECRET=<your-bitrix24-client-secret>
BITRIX24_REDIRECT_URI=https://<your-ngrok-url>/api/auth/callback
ENCRYPTION_KEY=<your-secure-encryption-key>
```

### Run Migrations

```bash

npm run typeorm:migration:run
```

---

## 3. Client Setup (Laravel)

Navigate to the client directory and install PHP and JavaScript dependencies:

```bash

cd ../client
composer install
npm install && npm run dev
```

### Environment Variables

Copy the example file and update values:

```bash

cp .env.example .env
php artisan key:generate
```

```env

APP_URL=<your-frontend-url>
BASE_API_URL=<your-backend-api-url>
```

## 4. Start Required Services

Use Docker Compose to start Redis and RabbitMQ:

```bash

docker-compose up -d
```

Redis will run on port 6379
RabbitMQ will run on:
5672 (AMQP)
15672 (Management UI) → http://localhost:15672 (guest / guest)

## 5. Running the Application

### Start Backend Server

From the `server/` directory:

```bash

npm run start:dev # or yarn start:dev
```

API available at: `http://localhost:3000`

### Start Frontend Client

From the `client/` directory:

```bash

php artisan serve
```

App available at: `http://localhost:8000`

---

## 🎉 You're All Set!

Visit the app at `http://localhost:8000`
