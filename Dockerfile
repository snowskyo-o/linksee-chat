FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl libssl3 ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm install

COPY . .

RUN npm run build:web && npx prisma generate

EXPOSE 3010

CMD ["sh", "-c", "npx prisma db push && node ./prisma/seed.mjs && node ./apps/api/src/server/index.mjs"]
