# Use the official Clojure image as the base
FROM clojure:openjdk-17

# Set the working directory
WORKDIR /app

# Copy the project files
COPY deps.edn ./
COPY src ./src

# Download dependencies
RUN clojure -P

# Copy the rest of the application
COPY . .

# Expose the port the app runs on
EXPOSE 8080

# Define the command to run the application
CMD ["clojure", "-M", "-m", "myapp.system"]
