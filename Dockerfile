FROM node:16-alpine as builder

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json /app/

RUN npm --quiet set progress=false \
 && npm config --location=global set update-notifier false \
 && npm ci --include=dev --omit=optional --prefer-online \
 && echo "Installed NPM packages:" \
 && npm list --include=dev --omit=optional \
 && echo "Node.js version:" \
 && node --version \
 && echo "NPM version:" \
 && npm --version

COPY index.ts tsconfig.json /app/
RUN npm run build


FROM node:16-alpine

WORKDIR /app
ENV NODE_ENV=production

# Enable Node.js process to use a lot of memory (actor has limit of 32GB)
# Increases default size of headers. The original limit was 80kb, but from node 10+ they decided to lower it to 8kb.
# However they did not think about all the sites there with large headers,
# so we put back the old limit of 80kb, which seems to work just fine.
ENV NODE_OPTIONS="--max_old_space_size=30000 --max-http-header-size=80000"

COPY package.json package-lock.json /app/

RUN npm --quiet set progress=false \
 && npm config --location=global set update-notifier false \
 && npm ci --omit=dev --omit=optional --prefer-online \
 && echo "Installed NPM packages:" \
 && npm list --omit=dev --omit=optional \
 && echo "Node.js version:" \
 && node --version \
 && echo "NPM version:" \
 && npm --version

COPY --from=builder /app/dist/index.js /app/dist/
COPY ./apify.json /app/
CMD npm run start
