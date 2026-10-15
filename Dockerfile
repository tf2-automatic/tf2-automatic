# syntax=docker/dockerfile:1
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS base
WORKDIR /app
# pnpm version from "packageManager" in package.json
COPY package.json ./
RUN npm i -g "$(node -p 'require("./package.json").packageManager')"
ENV CI=true NX_DAEMON=false

# 1. Dev dependencies: cached until package.json / lockfile / patches change.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

FROM deps AS build
# 2. Nx project graph from config files only: cached until nx/project config changes.
COPY nx.json tsconfig.base.json ./
COPY --parents apps/*/project.json apps/*/package.json libs/*/project.json libs/*/package.json ./
RUN node_modules/.bin/nx show projects >/dev/null
# 3. Source + build one app. ARG APP after the shared layers so all apps share them.
COPY . .
ARG APP
RUN test -n "$APP"
RUN node_modules/.bin/nx build $APP --skip-nx-cache --skipTypeChecking

# 4. Production dependencies for that app, offline from the dev install's pnpm store.
#    Cached while the app's generated package.json + lockfile are unchanged.
FROM base AS installer
ARG APP
COPY --from=build /app/dist/apps/$APP/package.json /app/dist/apps/$APP/pnpm-lock.yaml ./
COPY pnpm-workspace.yaml .pnpmfile.cjs ./
COPY patches ./patches
RUN --mount=type=bind,from=deps,source=/root/.local/share/pnpm/store,target=/root/.local/share/pnpm/store,rw \
    --mount=type=bind,from=deps,source=/root/.cache/pnpm,target=/root/.cache/pnpm,rw \
    pnpm install --frozen-lockfile --prod --offline

FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS runner
ENV NODE_ENV=production
WORKDIR /app
ARG APP
COPY --from=build --chown=nestjs:nodejs /app/dist/apps/$APP ./
ARG VERSION
RUN if [ -n "$VERSION" ]; then sed -i 's/"version": .*/"version": "'"$VERSION"'",/' package.json; fi
COPY --from=installer /app/node_modules ./node_modules
EXPOSE 3000
ENV PORT=3000
CMD ["node", "--enable-source-maps", "main.js"]
