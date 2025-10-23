from golang:1.16-alpine 3.14
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download
COPY . .

Run CGO_ENABLED=0 GO BUILD -o /bin/app ./cmd

from alpine:3.14
WORKDIR /src
COPY --from=0 /bin/app /bin/app
COPY --from=0 /src/assets src/assets
COPY --from=0 /src/views src/views

ENTRYPOINT ["/bin/app"]