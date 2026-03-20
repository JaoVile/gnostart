FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY public ./public
COPY src ./src

ARG VITE_API_BASE_URL=
ARG VITE_MAP_ID=default_map
ARG VITE_ADMIN_API_KEY=
ARG VITE_REQUIRE_ACCESS_GATE=true
ARG VITE_REQUIRE_TEMP_LOGIN=true

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_MAP_ID=$VITE_MAP_ID \
    VITE_ADMIN_API_KEY=$VITE_ADMIN_API_KEY \
    VITE_REQUIRE_ACCESS_GATE=$VITE_REQUIRE_ACCESS_GATE \
    VITE_REQUIRE_TEMP_LOGIN=$VITE_REQUIRE_TEMP_LOGIN

RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
