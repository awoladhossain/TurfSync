FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

RUN npx prisma generate

COPY . .

RUN npm run build

# stage 2 production image

FROM node:20-alpine AS production

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001


COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --only=production && \
    npx prisma generate && \
    npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries= \
 CMD wget -q0- http://localhost:3000/health || exit 1


CMD [ "node", "dist/main.js" ]