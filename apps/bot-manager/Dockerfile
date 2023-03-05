FROM node:18-alpine as deps
WORKDIR /usr/src/app
COPY dist/apps/bot-manager/package*.json ./
COPY package-lock.json ./
RUN npm ci --omit=dev

FROM node:18-alpine as runner
ENV NODE_ENV production
WORKDIR /usr/src/app
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001
COPY --chown=nestjs:nodejs dist/apps/bot-manager ./
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=deps /usr/src/app/package*.json ./
USER nestjs
EXPOSE 3000
ENV PORT 3000
CMD ["node", "main.js"]
