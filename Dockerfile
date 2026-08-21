FROM node:22-bookworm-slim
WORKDIR /app
COPY --chown=node:node . .
RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production PORT=8787 HOST=0.0.0.0 DATABASE_PATH=/data/serenitype.sqlite
USER node
EXPOSE 8787
VOLUME ["/data"]
CMD ["node", "server/server.js"]

