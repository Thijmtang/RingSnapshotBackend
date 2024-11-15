# Set the base image from Docker repository to build our app. In this case we want to use node image to run our node app
FROM node:18.20-alpine3.19
WORKDIR /app
COPY . .
RUN npm install

# Expose port 3000, and start the app.
EXPOSE 3000

# Build typescript backend
RUN npm run build

# Project has been compiled to js, open it using node
CMD ["node", "dist/index.js"]