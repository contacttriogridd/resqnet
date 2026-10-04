# RESQNET PWA — build context is the repository root:
#   docker build -f frontend/Dockerfile -t resqnet-web .
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY . .
ARG VITE_API_BASE_URL=/api
ARG VITE_DEFAULT_REGION=Coimbatore
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL VITE_DEFAULT_REGION=$VITE_DEFAULT_REGION
RUN npm ci --ignore-scripts \
 && npm run build -w @resqnet/shared \
 && npm run build -w @resqnet/frontend

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
