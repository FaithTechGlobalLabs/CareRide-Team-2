#backend
FROM --platform=linux/amd64 node:22-alpine AS backend

WORKDIR /app/backend

COPY package*.json ./

RUN npm ci

COPY . ./

RUN npm run build


#container
FROM --platform=linux/amd64 node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY --from=backend /app/backend/dist ./dist
COPY --from=backend /app/backend/db ./db

ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/index.js"]
