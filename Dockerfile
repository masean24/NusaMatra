# Nusa Matra frontend: a static Vite build served by nginx (Coolify: build pack "Dockerfile", port 80).
# No .env is needed: production defaults (LIVE, https://api.nusamatra.site) live in src/lib/publicConfig.ts.
# To point at another Data Hub, pass VITE_API_BASE_URL as a build argument in Coolify.

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
