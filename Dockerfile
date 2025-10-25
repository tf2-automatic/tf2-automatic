FROM node:24-alpine AS base
RUN npm i -g pnpm@10

FROM alpine:3.22.2 AS source
WORKDIR /app
ARG SOURCE_DIR
RUN test -n "$SOURCE_DIR"
COPY $SOURCE_DIR ./

FROM base AS installer
WORKDIR /app
COPY --from=source /app/package.json /app/pnpm-lock.yaml ./
COPY ./patches ./patches
COPY ./.pnpmfile.cjs ./
RUN pnpm install --frozen-lockfile --prod

FROM node:24-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=source --chown=nestjs:nodejs /app ./
ARG VERSION
RUN test -n "$VERSION"
RUN sed -i 's/"version": .*/"version": "'"$VERSION"'",/' package.json
COPY --from=installer /app/node_modules ./node_modules
EXPOSE 3000
ENV PORT=3000
CMD ["node", "main.js"]
