.PHONY: build-dev run-dev clean-dev run build test

# Development commands
build-dev:
	docker build -t xsami -f containers/images/Dockerfile .
	docker build -t turn -f containers/images/Dockerfile.turn .

run-dev:
	docker-compose -f containers/composes/dc.dev.yml up

clean-dev:
	docker-compose -f containers/composes/dc.dev.yml down

# Local development
run:
	go run cmd/main.go

build:
	go build -o bin/xsami cmd/main.go

test:
	go test ./...

# Install dependencies
deps:
	go mod download
	go mod tidy

# Format code
fmt:
	go fmt ./...

# Lint code
lint:
	golangci-lint run

# Clean build artifacts
clean:
	rm -rf bin/
	go clean
