FROM node:24-alpine AS base
WORKDIR /app
COPY package.json package-lock.json turbo.json ./
COPY apps ./apps
COPY packages ./packages
COPY services ./services
RUN npm install --global npm@11.6.1 \
    && npm ci
ARG WORKSPACE
RUN npm run db:generate --workspace=$WORKSPACE --if-present
ENV WORKSPACE=$WORKSPACE
CMD ["sh", "-c", "npm run dev --workspace=$WORKSPACE"]
