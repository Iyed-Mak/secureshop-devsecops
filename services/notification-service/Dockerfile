FROM node:18-alpine

# Create non-root user
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src/ ./src/

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

EXPOSE 8005

CMD ["npm", "start"]