FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json index.html postcss.config.mjs vite.config.ts ./
COPY public ./public
COPY src ./src

# Gioi han heap Node de build khong chiem het RAM VPS dang phuc vu thi sinh.
ENV NODE_OPTIONS=--max-old-space-size=1536
RUN npm ci && npm run build

FROM nginx:1.27-alpine

COPY deploy/frontend-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
