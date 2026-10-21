FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_BASE_PATH=/
ARG VITE_DATA_SOURCE=api
ARG VITE_API_URL=/backend
ARG VITE_MEDIA_BASE_URL=/media
ENV VITE_BASE_PATH=$VITE_BASE_PATH VITE_DATA_SOURCE=$VITE_DATA_SOURCE VITE_API_URL=$VITE_API_URL VITE_MEDIA_BASE_URL=$VITE_MEDIA_BASE_URL
RUN npm run build

FROM node:22-alpine AS api
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY scripts ./scripts
COPY database ./database
USER node
EXPOSE 8787
CMD ["node","server/index.mjs"]

FROM nginx:1.28-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
