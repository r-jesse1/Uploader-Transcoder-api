# syntax=docker/dockerfile:1

FROM node:22-alpine
WORKDIR /usr/src/app
COPY . .
RUN yarn install --production
CMD ["npm", "run", "start"]
EXPOSE 3000
EXPOSE 3005