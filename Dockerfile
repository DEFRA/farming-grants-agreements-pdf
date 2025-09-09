ARG PARENT_VERSION=2.8.5-node22.16.0
ARG PORT=3000
ARG PORT_DEBUG=9229

FROM defradigital/node-development:${PARENT_VERSION} AS development
ARG PARENT_VERSION
LABEL uk.gov.defra.ffc.parent-image=defradigital/node-development:${PARENT_VERSION}

# Install Chromium & fonts (needed for local dev PDF gen)
USER root
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont
USER node

ARG PORT
ARG PORT_DEBUG
ENV PORT=${PORT}
EXPOSE ${PORT} ${PORT_DEBUG}

COPY --chown=node:node package*.json ./
RUN npm install
COPY --chown=node:node ./src ./src

# Skip Puppeteer download since we use system Chromium
ENV PUPPETEER_SKIP_DOWNLOAD=1

CMD [ "npm", "run", "docker:dev" ]

FROM defradigital/node:${PARENT_VERSION} AS production
ARG PARENT_VERSION
LABEL uk.gov.defra.ffc.parent-image=defradigital/node:${PARENT_VERSION}

# Add curl to template.
# CDP PLATFORM HEALTHCHECK REQUIREMENT
USER root
# Healthcheck tool from your base plus Chromium deps
RUN apk update && apk add --no-cache \
    curl \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont
USER node

# Tell app where Chromium is
ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY --from=development /home/node/package*.json ./
COPY --from=development /home/node/src ./src/

RUN npm ci --omit=dev

ARG PORT
ENV PORT=${PORT}
EXPOSE ${PORT}

CMD [ "node", "src" ]
