# Use the official Clojure image as the base
FROM clojure:temurin-24-tools-deps-alpine

# Set the working directory
WORKDIR /app

# Copy the project files
COPY . .

# Download dependencies
RUN clojure -P

# Expose the port the app runs on
EXPOSE 8080

# Define the command to run the application
CMD ["clojure", "-M", "-m", "myscore.system"]
