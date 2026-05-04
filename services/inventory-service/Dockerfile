# 1. Use official Node.js runtime
FROM node:20-alpine

# 2. Set working directory inside container
WORKDIR /app

# 3. Copy only dependency files first (for caching)
COPY package*.json ./

# 4. Install dependencies inside container
RUN npm install

# 5. Copy the rest of the application code
COPY . .

# 6. Expose the port (change if your app uses another port)
EXPOSE 8006

# 7. Run the service
CMD ["node", "src/index.js"]