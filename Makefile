.PHONY: clean run test

PROJECT_NAME := myscore
MAIN_MODULE := myscore.system

clean:
	@echo "Cleaning..."
	rm -rf target/

deps:
	@echo "Resolving dependencies..."
	clj -P

run: deps
	@echo "Running ${PROJECT_NAME}..."
	clj -M -m $(MAIN_MODULE)

test: deps
	@echo "Running tests..."
	clj -X :test/runner {}
