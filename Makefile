.PHONY: clean deps run test install-frontend run-frontend build-frontend run-dev docker-build docker-run help

PROJECT_NAME := myscore
MAIN_MODULE := myscore.system
FRONTEND_DIR := scoreboard-ui

# Backend commands
clean:
	@echo "Cleaning..."
	rm -rf target/
	rm -rf $(FRONTEND_DIR)/build/
	rm -rf $(FRONTEND_DIR)/node_modules/

deps:
	@echo "Resolving backend dependencies..."
	clj -P

run: deps
	@echo "Running backend service..."
	clj -M -m $(MAIN_MODULE)

test: deps
	@echo "Running backend tests..."
	clj -X :test/runner {}

# Frontend commands
install-frontend:
	@echo "Installing frontend dependencies..."
	cd $(FRONTEND_DIR) && npm install

run-frontend: install-frontend
	@echo "Starting frontend development server..."
	cd $(FRONTEND_DIR) && npm start

build-frontend: install-frontend
	@echo "Building frontend for production..."
	cd $(FRONTEND_DIR) && npm run build

# Development
run-dev: deps
	@echo "Starting development environment..."
	@trap 'kill %1; kill %2' SIGINT; \
	make run & \
	make run-frontend & \
	wait

# Docker commands
docker-build:
	@echo "Building Docker image..."
	docker build -t score-me .

docker-run:
	@echo "Running Docker container..."
	docker run -p 8080:8080 \
		-e MONGODB_URI=mongodb://localhost:27017/score-me \
		score-me

# Help
help:
	@echo "Available commands:"
	@echo "Backend commands:"
	@echo "  make clean         - Clean all build artifacts"
	@echo "  make deps          - Install backend dependencies"
	@echo "  make run           - Run backend service"
	@echo "  make test          - Run backend tests"
	@echo ""
	@echo "Frontend commands:"
	@echo "  make install-frontend  - Install frontend dependencies"
	@echo "  make run-frontend     - Start frontend development server"
	@echo "  make build-frontend   - Build frontend for production"
	@echo ""
	@echo "Development:"
	@echo "  make run-dev       - Run both frontend and backend in development mode"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build  - Build Docker image"
	@echo "  make docker-run    - Run Docker container"
