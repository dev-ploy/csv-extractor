FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=builder /app/node_modules ./node_modules
COPY prisma ./prisma
COPY src ./src
COPY package*.json ./
RUN npx prisma generate
EXPOSE 3000
CMD ["node", "src/index.js"]
