FROM node:20-alpine AS base
RUN npm i -g pnpm

FROM scratch AS source
WORKDIR /app
ARG SOURCE_DIR=dist/apps/bot-manager
COPY $SOURCE_DIR ./

FROM base AS installer
WORKDIR /app
COPY --from=source /app/package.json /app/pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile --prod

FROM node:20-alpine AS runner
ENV NODE_ENV production
WORKDIR /app
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001
COPY --from=source --chown=nestjs:nodejs /app ./
COPY --from=installer /app/node_modules ./node_modules
USER nestjs
EXPOSE 3000
ENV PORT 3000
CMD ["node", "main.js"]
