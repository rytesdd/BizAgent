FROM node:18-alpine

WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Expose port 3001
EXPOSE 3001

# Start the application
CMD ["npm", "run", "server"]
