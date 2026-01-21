SHELL=/bin/bash
MAKEFLAGS+=-s

LOCAL_DIR=$(PWD)/_local
DATA_DIR=$(LOCAL_DIR)/data

reset-volumes:
	make down; \
	POCKETBASE_DIR=$(DATA_DIR)/pocketbase && sudo rm -rdf $$POCKETBASE_DIR \
		&& sudo mkdir -p $$POCKETBASE_DIR && sudo chown -R 1001:1001 $$POCKETBASE_DIR

down:
	touch .env; docker compose down || true

run:
	make down; docker compose up --build -V --force-recreate

run-detach:
	make down; docker compose up --build -V --force-recreate -d

build-multi:
	docker buildx build --platform linux/amd64,linux/arm64,linux/arm/v7 -t muayyad1999/pocketbase:latest .

build-local:
	docker buildx build --load -t muayyad1999/pocketbase:latest .

logs:
	docker compose logs -f
