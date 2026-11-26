SHELL := /bin/sh
.DEFAULT_GOAL := help

COMPOSE := docker compose
WEB_PORT ?= $(shell grep -s '^WEB_PORT=' .env | cut -d= -f2)
URL := http://localhost:$(or $(WEB_PORT),8080)

.PHONY: help env up down restart rebuild logs ps clean \
	install dev-api dev-web migrate seed \
	test test-unit test-e2e test-web coverage lint check \
	db-shell backup

help: ## Mostra esta ajuda
	@echo "Me Socorre Aki - uso: make <comando>"
	@echo
	@grep -E '^[a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

## ---------- Docker (uso normal) ----------

env: .env ## Cria o .env a partir do .env.example (se ainda não existir)

.env:
	@cp .env.example .env
	@echo ".env criado. Troque POSTGRES_PASSWORD e SEED_PASSWORD antes de usar."

up: .env ## Sobe banco, API e site em segundo plano
	$(COMPOSE) up --build -d
	@echo
	@echo "Pronto: $(URL)  (API: $(URL)/api/docs)"

down: ## Desliga tudo e mantém os dados
	$(COMPOSE) down

restart: ## Reinicia os contêineres
	$(COMPOSE) restart

rebuild: .env ## Recompila as imagens do zero e sobe de novo
	$(COMPOSE) build --no-cache
	$(COMPOSE) up -d

logs: ## Acompanha os logs (Ctrl+C para sair)
	$(COMPOSE) logs -f

ps: ## Mostra o estado dos contêineres
	$(COMPOSE) ps

clean: ## APAGA banco e anexos (o próximo "make up" recria a demo)
	$(COMPOSE) down -v

## ---------- Desenvolvimento sem Docker ----------

install: ## Instala as dependências do backend e do frontend
	cd backend && npm install
	cd frontend && npm install

dev-api: ## Roda a API em modo desenvolvimento (porta 3000)
	cd backend && npm run start:dev

dev-web: ## Roda o site em modo desenvolvimento (porta 5173)
	cd frontend && npm run dev

migrate: ## Aplica as migrações no banco do backend/.env
	cd backend && npx prisma migrate deploy

seed: ## Cria os dados de demonstração no banco do backend/.env
	cd backend && npm run seed

## ---------- Qualidade ----------

test: test-unit test-e2e test-web ## Roda todos os testes

test-unit: ## Testes unitários do backend
	cd backend && npm test

test-e2e: ## Testes de integração do backend (PostgreSQL temporário)
	cd backend && npm run test:e2e

test-web: ## Testes do frontend
	cd frontend && npm test

coverage: ## Cobertura dos testes de integração do backend
	cd backend && npx jest --config test/jest-e2e.json --runInBand --forceExit --coverage

lint: ## Verifica os tipos do TypeScript (backend e frontend)
	cd backend && npm run lint
	cd frontend && npm run lint

check: lint test ## Tudo que a CI verifica: tipos e testes

## ---------- Banco de dados ----------

db-shell: ## Abre o psql no banco do Docker
	$(COMPOSE) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

backup: ## Exporta o banco do Docker para backups/
	@mkdir -p backups
	$(COMPOSE) exec -T db sh -c 'pg_dump -U "$$POSTGRES_USER" "$$POSTGRES_DB"' > backups/backup-$$(date +%Y%m%d-%H%M%S).sql
	@echo "Backup salvo em backups/"
