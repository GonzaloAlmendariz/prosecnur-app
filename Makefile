SHELL := /bin/bash
REPO_ROOT := $(shell pwd)
PACKAGE_NAME := Prosecnur
PACKAGE_DIR := $(REPO_ROOT)/dist/$(PACKAGE_NAME)
PACKAGE_STAGING := $(REPO_ROOT)/dist/.package-staging/$(PACKAGE_NAME)

.PHONY: help dev-api dev-frontend build clean install-r install-frontend install-desktop desktop package-local

help:
	@echo "Targets:"
	@echo "  install-r        Install R dependencies for the local app"
	@echo "  install-frontend Install frontend dependencies (pnpm)"
	@echo "  install-desktop  Install Electron desktop dependencies (pnpm)"
	@echo "  dev-api          Run Plumber API in dev mode (no frontend build)"
	@echo "  dev-frontend     Run Vite dev server (proxies /api to 127.0.0.1:8787)"
	@echo "  desktop          Build frontend and open the desktop window"
	@echo "  build            Build the frontend into api/inst/www"
	@echo "  package-local    Build a local executable folder in dist/"
	@echo "  clean            Remove build output"

install-r:
	Rscript launcher/install-r-deps.R

install-frontend:
	cd frontend && pnpm install

install-desktop:
	cd desktop && pnpm install

dev-api:
	Rscript launcher/launch.R

dev-frontend:
	cd frontend && pnpm dev

build:
	cd frontend && pnpm build

desktop: build
	cd desktop && pnpm start

package-local: build
	rm -rf "$(PACKAGE_STAGING)"
	mkdir -p "$(PACKAGE_STAGING)/Internals"
	mkdir -p "$(PACKAGE_STAGING)/Prosecnur.app/Contents/Resources/Internals"
	rsync -a --delete --exclude ".DS_Store" --exclude "tests" api/ "$(PACKAGE_STAGING)/Internals/api/"
	rsync -a --delete --exclude ".DS_Store" launcher/ "$(PACKAGE_STAGING)/Internals/launcher/"
	rsync -a --delete --exclude ".DS_Store" --exclude "node_modules" desktop/ "$(PACKAGE_STAGING)/Internals/desktop/"
	rsync -a --delete --exclude ".DS_Store" packaging/macos/Prosecnur.app/ "$(PACKAGE_STAGING)/Prosecnur.app/"
	rsync -a --delete --exclude ".DS_Store" --exclude "tests" api/ "$(PACKAGE_STAGING)/Prosecnur.app/Contents/Resources/Internals/api/"
	rsync -a --delete --exclude ".DS_Store" launcher/ "$(PACKAGE_STAGING)/Prosecnur.app/Contents/Resources/Internals/launcher/"
	rsync -a --delete --exclude ".DS_Store" --exclude "node_modules" desktop/ "$(PACKAGE_STAGING)/Prosecnur.app/Contents/Resources/Internals/desktop/"
	cp LICENSE "$(PACKAGE_STAGING)/LICENSE"
	cp README.md "$(PACKAGE_STAGING)/README_DESARROLLO.md"
	cp packaging/LEEME_PRIMERO.md "$(PACKAGE_STAGING)/LEEME_PRIMERO.md"
	chmod +x "$(PACKAGE_STAGING)/Prosecnur.app/Contents/MacOS/Prosecnur"
	chmod +x "$(PACKAGE_STAGING)/Internals/launcher/"*.command "$(PACKAGE_STAGING)/Internals/launcher/"*.sh "$(PACKAGE_STAGING)/Internals/launcher/launch.R" "$(PACKAGE_STAGING)/Internals/launcher/install-r-deps.R"
	rm -rf "$(PACKAGE_DIR)"
	rm -rf "$(REPO_ROOT)/dist/$(PACKAGE_NAME) 2"
	rm -rf "$(REPO_ROOT)/dist/.old-$(PACKAGE_NAME)-"*
	rm -rf "$(REPO_ROOT)/dist/.Prosecnur-old-cleanup"
	mv "$(PACKAGE_STAGING)" "$(PACKAGE_DIR)"
	rm -rf "$(REPO_ROOT)/dist/.package-staging"
	@echo ""
	@echo "Paquete local listo:"
	@echo "  $(PACKAGE_DIR)"
	@echo ""
	@echo "Para probarlo en macOS:"
	@echo "  open \"$(PACKAGE_DIR)/Prosecnur.app\""
	@echo ""
	@echo "Fallback en navegador:"
	@echo "  open \"$(PACKAGE_DIR)/Internals/launcher/prosecnur.command\""

clean:
	rm -rf api/inst/www/*
