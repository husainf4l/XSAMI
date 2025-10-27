FROM golang:1.23-alpine AS builder
WORKDIR /src

# Install build dependencies
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o /bin/app ./cmd

# Final stage
FROM alpine:3.19
WORKDIR /app

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

# Copy binary and assets
COPY --from=builder /bin/app /app/
COPY --from=builder /src/assets /app/assets
COPY --from=builder /src/views /app/views

# Expose port
EXPOSE 8080

# Run application
ENTRYPOINT ["/app/app"]