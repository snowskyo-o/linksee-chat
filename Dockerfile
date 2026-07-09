FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

RUN npm run build:web && npx prisma generate

EXPOSE 3010

CMD ["sh", "-c", "npx prisma db push && node ./prisma/seed.mjs && node ./apps/api/src/server/index.mjs"]
