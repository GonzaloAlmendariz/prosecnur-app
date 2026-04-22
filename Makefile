SHELL := /bin/bash
REPO_ROOT := $(shell pwd)
PACKAGE_NAME := Prosecnur
# Usamos `dist.nosync/` en vez de `dist/` porque macOS trata el sufijo
# .nosync como señal para que iCloud Drive NO sincronice esa carpeta.
# Sin esto, cuando el repo vive dentro de iCloud Drive, el Makefile
# hacía `rm -rf dist/Prosecnur` + `mv staging dist/Prosecnur` y iCloud
# interpretaba el reemplazo como conflicto, creando copias fantasma
# tipo "Prosecnur 2", "Prosecnur 3", "Prosecnur 4". El sufijo .nosync
# evita eso en cualquier máquina (si el usuario no usa iCloud, el
# sufijo es inofensivo — solo un nombre de directorio).
DIST_ROOT := $(REPO_ROOT)/dist.nosync
PACKAGE_DIR := $(DIST_ROOT)/$(PACKAGE_NAME)
PACKAGE_STAGING := $(DIST_ROOT)/.package-staging/$(PACKAGE_NAME)

.PHONY: help dev-api dev-frontend build clean install-r install-frontend install-desktop desktop package-local

help:
	@echo "Entrada normal del usuario:"
	@echo "  doble click en Prosecnur.app (macOS) o Prosecnur.bat (Windows)"
	@echo "  — corren en modo DEV si el archivo vive dentro del repo"
	@echo "  — en modo PACKAGED si está en dist.nosync/Prosecnur/"
	@echo ""
	@echo "Targets de Make para desarrollo:"
	@echo "  install-r        Install R dependencies"
	@echo "  install-frontend Install frontend dependencies (pnpm)"
	@echo "  install-desktop  Install Electron dependencies (pnpm)"
	@echo "  dev-api          Run Plumber API (no frontend build, no Electron)"
	@echo "  dev-frontend     Run Vite dev server (proxies /api to :8787)"
	@echo "  build            Build the frontend into api/inst/www"
	@echo "  package-local    Generate distributable in dist.nosync/Prosecnur/"
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
	# Layout del paquete distribuible:
	#   dist.nosync/Prosecnur/
	#     Prosecnur.app/                 ← macOS, doble click
	#       Contents/Resources/Internals ← fuentes embebidas (modo packaged)
	#     Prosecnur.bat                  ← Windows, doble click
	#     Internals/                     ← fuentes para el .bat (espejo)
	#     LEEME_PRIMERO.md
	#     LICENSE
	#     README_DESARROLLO.md
	mkdir -p "$(PACKAGE_STAGING)/Prosecnur.app/Contents/Resources/Internals"
	mkdir -p "$(PACKAGE_STAGING)/Internals"
	# Copia del template del .app (Info.plist + Contents/MacOS/Prosecnur bash).
	rsync -a --delete --exclude ".DS_Store" Prosecnur.app/ "$(PACKAGE_STAGING)/Prosecnur.app/"
	# Fuentes embebidas dentro del .app (modo packaged usa Resources/Internals).
	rsync -a --delete --exclude ".DS_Store" --exclude "tests" api/ "$(PACKAGE_STAGING)/Prosecnur.app/Contents/Resources/Internals/api/"
	rsync -a --delete --exclude ".DS_Store" launcher/ "$(PACKAGE_STAGING)/Prosecnur.app/Contents/Resources/Internals/launcher/"
	rsync -a --delete --exclude ".DS_Store" --exclude "node_modules" desktop/ "$(PACKAGE_STAGING)/Prosecnur.app/Contents/Resources/Internals/desktop/"
	# Fuentes para el launcher Windows (.bat). Las espeja al lado del .bat.
	cp Prosecnur.bat "$(PACKAGE_STAGING)/Prosecnur.bat"
	rsync -a --delete --exclude ".DS_Store" --exclude "tests" api/ "$(PACKAGE_STAGING)/Internals/api/"
	rsync -a --delete --exclude ".DS_Store" launcher/ "$(PACKAGE_STAGING)/Internals/launcher/"
	rsync -a --delete --exclude ".DS_Store" --exclude "node_modules" desktop/ "$(PACKAGE_STAGING)/Internals/desktop/"
	# Docs
	cp LICENSE "$(PACKAGE_STAGING)/LICENSE"
	cp README.md "$(PACKAGE_STAGING)/README_DESARROLLO.md"
	cp packaging/LEEME_PRIMERO.md "$(PACKAGE_STAGING)/LEEME_PRIMERO.md"
	# Permisos ejecutables
	chmod +x "$(PACKAGE_STAGING)/Prosecnur.app/Contents/MacOS/Prosecnur"
	chmod +x "$(PACKAGE_STAGING)/Internals/launcher/launch.R" "$(PACKAGE_STAGING)/Internals/launcher/install-r-deps.R"
	chmod +x "$(PACKAGE_STAGING)/Prosecnur.app/Contents/Resources/Internals/launcher/launch.R" "$(PACKAGE_STAGING)/Prosecnur.app/Contents/Resources/Internals/launcher/install-r-deps.R"
	rm -rf "$(PACKAGE_DIR)"
	# Limpia copias fantasma creadas por iCloud en sync-conflict ("Prosecnur 2",
	# "Prosecnur 3", etc.) tanto en dist.nosync como en el legado dist/.
	find "$(DIST_ROOT)" -maxdepth 1 -mindepth 1 -name "$(PACKAGE_NAME) *" -exec rm -rf {} + 2>/dev/null || true
	find "$(REPO_ROOT)/dist" -maxdepth 1 -mindepth 1 -name "$(PACKAGE_NAME) *" -exec rm -rf {} + 2>/dev/null || true
	rm -rf "$(DIST_ROOT)/.old-$(PACKAGE_NAME)-"* "$(REPO_ROOT)/dist/.old-$(PACKAGE_NAME)-"* 2>/dev/null || true
	mv "$(PACKAGE_STAGING)" "$(PACKAGE_DIR)"
	rm -rf "$(DIST_ROOT)/.package-staging"
	@echo ""
	@echo "Paquete local listo en:"
	@echo "  $(PACKAGE_DIR)"
	@echo ""
	@echo "macOS:   open \"$(PACKAGE_DIR)/Prosecnur.app\""
	@echo "Windows: doble click en $(PACKAGE_DIR)/Prosecnur.bat"

clean:
	rm -rf api/inst/www/*
