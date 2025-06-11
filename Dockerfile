# Use an official Node.js runtime as a parent image
FROM node:18-slim

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install app dependencies
RUN npm install --production

# Copy the rest of the application source code to the working directory
COPY . .

# Grant execute permission to the proxy server binary for the root user
# We keep this for now in case other parts of the app still reference it.
# We will remove it in a later step.
RUN chmod +x /app/src/proxy/chrome_proxy_server_linux_amd64

# Switch to a non-root user for security. This is a good practice.
USER node

# Make port 7860 available to the world outside this container
EXPOSE 7860

# Define the command to run the app
CMD ["npm", "start"] 