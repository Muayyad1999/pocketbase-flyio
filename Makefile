.PHONY: run run-detach down logs build-local
run:
	docker compose up --build
run-detach:
	docker compose up --build -d
down:
	docker compose down
logs:
	docker compose logs -f
build-local:
	docker build -t al-salam-pocketbase:0.40.4 .
