# ==========================================
# Stage 0: Development
# ==========================================
FROM node:20-alpine AS development

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .


RUN npx prisma generate

EXPOSE 4000


CMD [ "npm", "run", "start:dev" ]


# ==========================================
# Stage 1: Builder
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

RUN npx prisma generate

COPY . .

RUN npm run build

# ==========================================
# Stage 2: Production Image
# ==========================================
FROM node:20-alpine AS production

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --omit=dev && \
    npm cache clean --force

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

COPY --from=builder /app/dist ./dist

RUN chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:4000/health || exit 1

CMD [ "node", "dist/main.js" ]