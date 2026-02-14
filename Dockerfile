FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY server/ ./server/

WORKDIR /app/server
RUN npm install --production

WORKDIR /app

EXPOSE 3210

ENV NODE_ENV=production
ENV PORT=3210

CMD ["node", "server/index.mjs"]
