FROM node:22-alpine AS client
WORKDIR /client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/ ./
COPY --from=client /client/dist ./public
ENV PORT=5000
EXPOSE 5000
CMD ["node", "index.js"]
