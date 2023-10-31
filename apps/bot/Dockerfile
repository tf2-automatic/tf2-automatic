FROM node:18-alpine AS base
RUN npm i -g pnpm

FROM alpine:3.18.4 AS source
WORKDIR /app
ARG SOURCE_DIR
RUN test -n "$SOURCE_DIR"
COPY $SOURCE_DIR ./

FROM base AS installer
WORKDIR /app
COPY --from=source /app/package.json /app/pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile --prod

FROM node:18-alpine as runner
ENV NODE_ENV production
WORKDIR /app
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001
COPY --from=source --chown=nestjs:nodejs /app ./
ARG VERSION
RUN test -n "$VERSION"
RUN sed -i 's/"version": .*/"version": "'"$VERSION"'",/' package.json
COPY --from=installer /app/node_modules ./node_modules
USER nestjs
EXPOSE 3000
ENV PORT 3000
CMD ["node", "main.js"]
