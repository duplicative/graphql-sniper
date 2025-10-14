FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY . .

# Expose GraphQL server port
EXPOSE 4000

# Start the server
CMD ["npm", "start"]
