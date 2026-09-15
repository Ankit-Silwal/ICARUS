FROM node:24-alpine AS base
WORKDIR /app
COPY package.json package-lock.json turbo.json ./
COPY apps ./apps
COPY packages ./packages
COPY services ./services
RUN npm ci
ARG WORKSPACE
ENV WORKSPACE=$WORKSPACE
CMD ["sh", "-c", "npm run dev --workspace=$WORKSPACE"]
