FROM node:24.15.0-alpine

WORKDIR /site
COPY package.json package-lock.json ./
RUN npm ci --offline
COPY . .
RUN node --check app.js && node --test smoke.test.mjs

EXPOSE 8080
CMD ["busybox", "httpd", "-f", "-p", "8080", "-h", "/site"]
