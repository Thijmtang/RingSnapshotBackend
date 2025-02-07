# Set the base image from Docker repository to build our app. In this case we want to use node image to run our node app
FROM node:18.20-alpine3.19

# Install ffmpeg for video recordings ring-client-api
RUN apk add --no-cache ffmpeg

WORKDIR /app
COPY . .
RUN npm install

EXPOSE 4000

# Build typescript backend
RUN npm run build

# Project has been compiled to js, open it using node
CMD ["node", "dist/index.js"]