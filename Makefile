SHELL := /bin/bash
REPO_ROOT := $(shell pwd)

.PHONY: help dev-api dev-frontend build clean install-r install-frontend

help:
	@echo "Targets:"
	@echo "  install-r        Install R dependencies (devtools/pkgload, plumber, prosecnur local)"
	@echo "  install-frontend Install frontend dependencies (pnpm)"
	@echo "  dev-api          Run Plumber API in dev mode (no frontend build)"
	@echo "  dev-frontend     Run Vite dev server (proxies /api to 127.0.0.1:8787)"
	@echo "  build            Build the frontend into api/inst/www"
	@echo "  clean            Remove build output"

install-r:
	Rscript -e 'if (!requireNamespace("pkgload", quietly=TRUE)) install.packages("pkgload"); \
	            if (!requireNamespace("remotes", quietly=TRUE)) install.packages("remotes"); \
	            remotes::install_local("../prosecnur", upgrade="never"); \
	            install.packages(c("plumber","jsonlite","webutils","mime","httpuv","later","callr","uuid","readxl","haven","ps","testthat"))'

install-frontend:
	cd frontend && pnpm install

dev-api:
	Rscript launcher/launch.R

dev-frontend:
	cd frontend && pnpm dev

build:
	cd frontend && pnpm build

clean:
	rm -rf api/inst/www/*
