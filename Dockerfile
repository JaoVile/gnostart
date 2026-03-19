FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY public ./public
COPY src ./src

ARG VITE_API_BASE_URL=http://localhost:3333
ARG VITE_MAP_ID=default_map
ARG VITE_ADMIN_API_KEY=
ARG VITE_REQUIRE_TEMP_LOGIN=true
ARG VITE_MAP_OVERLAY_URL=/maps/mapa-visual.png
ARG VITE_USE_TEST_MAP_CENTER=false

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_MAP_ID=$VITE_MAP_ID \
    VITE_ADMIN_API_KEY=$VITE_ADMIN_API_KEY \
    VITE_REQUIRE_TEMP_LOGIN=$VITE_REQUIRE_TEMP_LOGIN \
    VITE_MAP_OVERLAY_URL=$VITE_MAP_OVERLAY_URL \
    VITE_USE_TEST_MAP_CENTER=$VITE_USE_TEST_MAP_CENTER

RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
