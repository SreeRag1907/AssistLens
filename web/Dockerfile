FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_BASE=/api
ARG VITE_LIVEKIT_URL
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_LIVEKIT_URL=$VITE_LIVEKIT_URL
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
