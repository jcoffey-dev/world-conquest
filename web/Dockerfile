# The game is a static bundle. It is built here and served by nginx, in its own
# container - it shares nothing with the rest of the site but the domain.
#
# It talks to no service at all. There is no score to post: a game against
# five bots is won or lost, and a leaderboard of how many rounds it took would
# mostly measure the dice.
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig*.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
# Must match where the host proxies it, or the asset URLs will be wrong.
ARG BASE_PATH=/conquest/
ENV BASE_PATH=${BASE_PATH}
RUN npm run build

FROM nginx:alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
