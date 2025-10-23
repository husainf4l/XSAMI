#Dev

build-dev:
    docker build -t videochat -f containers/images/Dockerfile . && docker build -t turn -f containers/images/turn.Dockerfile.turn .

clean-dev:
	docker-compose -f containers/compose/dc.dev.yml.down


run-dev:
	docker-compose -f containers/compose/dc.dev.yml up
