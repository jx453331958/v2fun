FROM node:20-alpine AS builder

ARG COMMIT_HASH=dev
ENV COMMIT_HASH=${COMMIT_HASH}

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

RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3210

ENV NODE_ENV=production
ENV PORT=3210

CMD ["node", "server/index.mjs"]
