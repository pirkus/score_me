# Score Me

A scoring system with a Clojure backend and React frontend that allows users to create and manage scorecards.

## Project Structure

- `scoreboard-ui/` - React frontend application
- `src/` - Clojure backend application
- `Dockerfile` - Container configuration for the backend
- `Makefile` - Build and run scripts

## Prerequisites

- Node.js and npm (for frontend)
- Clojure and Java (for backend)
- Docker (optional, for containerized deployment)
- MongoDB (database)

## Environment Variables

### Frontend (scoreboard-ui)
- `REACT_APP_API_URL` - Backend API URL
  - Development: defaults to `http://localhost:8080`
  - Production: set to your production API URL (e.g., `http://141.148.60.81:8080`)

### Backend (src/)
The backend service requires MongoDB connection details:
- `MONGODB_URI` - MongoDB connection string (defaults to "mongodb://localhost:27017/score-me")

Note: Authentication is handled via Google OAuth. No additional JWT configuration is needed as the application verifies tokens directly with Google's authentication servers.

## Build and Run Instructions

The project includes a comprehensive Makefile for all build and run operations. Use `make help` to see all available commands.

### Quick Start (Development)

To start both frontend and backend in development mode:
```bash
make run-dev
```
This will:
- Install all dependencies (frontend and backend)
- Start the backend server on port 8080
- Start the frontend development server on port 3000
- Watch for changes in both frontend and backend

### Backend Operations

```bash
# Install backend dependencies
make deps

# Run backend service only
make run

# Run backend tests
make test
```

### Frontend Operations

```bash
# Install frontend dependencies
make install-frontend

# Start frontend development server
make run-frontend

# Build frontend for production
make build-frontend
```

### Cleanup

```bash
# Clean all build artifacts
make clean
```

## Production Deployment

### Using Docker

1. Build the frontend and Docker image:
```bash
# Build frontend for production
make build-frontend

# Build Docker image
make docker-build
```

2. Run the container:
```bash
# Run with default MongoDB URI
make docker-run

# Or run with custom MongoDB URI
docker run -p 8080:8080 \
  -e MONGODB_URI=your_mongodb_uri \
  score-me
```

### Manual Deployment

1. Build the frontend:
```bash
make build-frontend
```

2. Serve the frontend build directory (`scoreboard-ui/build`) using your preferred web server (nginx, Apache, etc.)

3. Start the backend service:
```bash
make run
```

## Development

### Directory Structure
```
.
├── scoreboard-ui/     # React frontend
├── src/              # Clojure backend
├── Dockerfile        # Container configuration
└── Makefile         # Build and run scripts
```

### Available Make Commands

#### Backend Commands
- `make clean` - Clean all build artifacts
- `make deps` - Install backend dependencies
- `make run` - Run backend service
- `make test` - Run backend tests

#### Frontend Commands
- `make install-frontend` - Install frontend dependencies
- `make run-frontend` - Start frontend development server
- `make build-frontend` - Build frontend for production

#### Development
- `make run-dev` - Run both frontend and backend in development mode

#### Docker
- `make docker-build` - Build Docker image
- `make docker-run` - Run Docker container

## Testing

Run backend tests:
```bash
make test
```

Run frontend tests:
```bash
cd scoreboard-ui
npm test
```

## License

[Your License Here] 