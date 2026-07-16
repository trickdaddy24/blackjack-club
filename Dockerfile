FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=7600
ENV HOSTNAME=0.0.0.0

# Prisma's engines need OpenSSL, which node:alpine doesn't ship
RUN apk add --no-cache openssl

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
# The prisma CLI requires the full @prisma scope (engines, get-platform, …)
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Operator scripts (admin promotion via `docker exec blackjack node scripts/...`)
COPY --from=builder /app/scripts ./scripts

EXPOSE 7600

# Push the schema on first boot (SQLite file lives in the mounted ./prisma volume)
CMD ["sh", "-c", "node node_modules/prisma/build/index.js db push --skip-generate && node server.js"]
