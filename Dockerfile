# The web frontend, built once and served by nginx as a non-root user (F6). The image
# is the same for every deployment: the addresses it talks to, and the
# Content-Security-Policy that allows them, are written at start from environment
# variables (deploy/start.sh), never baked into the build.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# No install scripts: nothing in the dependencies needs one, and none should run.
RUN npm ci --ignore-scripts
COPY . .
# public/config.json is the development settings: the deployment provides its own.
RUN npm run build && rm dist/config.json

FROM nginxinc/nginx-unprivileged:1.29-alpine
USER root
# The base's packages, as fixed upstream (musl images: see CLAUDE.md).
RUN apk upgrade --no-cache
COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY --chmod=0755 deploy/start.sh /usr/local/bin/vaultgate-frontend
COPY --from=build /app/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/vaultgate-frontend"]
