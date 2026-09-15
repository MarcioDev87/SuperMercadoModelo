FROM node:22-trixie-slim

ENV NODE_ENV=production \
    PORT=3051 \
    DB_PATH=/data/modelo.db

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts=false && npm cache clean --force

COPY --chown=node:node server.js db.js ./
COPY --chown=node:node src ./src
COPY --chown=node:node assets ./assets
COPY --chown=node:node data/catalog-seed.json ./data/catalog-seed.json
COPY --chown=node:node *.html ./

RUN mkdir -p /data && chown node:node /data
USER node

EXPOSE 3051
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3051/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
