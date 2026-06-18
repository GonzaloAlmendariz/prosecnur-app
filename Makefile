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
AUDIT_PORT ?= 8799
AUDIT_CDP_PORT ?= 9334
AUDIT_RUNS_DIR ?= $(REPO_ROOT)/outputs/audit-runs
AUDIT_PROJECT ?= $(REPO_ROOT)/api/inst/audit_reference/prosecnur_audit_reference.pulso
PULSO_PORT ?= 8787
VITE_DEV_PORT ?= 5173
PROSECNUR_VITE_URL ?= http://localhost:$(VITE_DEV_PORT)
QA_URL ?= http://localhost:5173/
QA_API ?= auto
QA_OUT ?= $(REPO_ROOT)/outputs/visual-qa/$(shell date +%Y%m%d-%H%M%S)

.PHONY: help dev-api dev-frontend dev-pulso dev-electron-vite visual-qa ui-quick-check monitoreo-qa audit-reference-build audit-reference-run audit-reference-smoke desktop-audit build build-if-stale clean install-r install-frontend install-desktop desktop desktop-fast package-local package-windows-self-contained package-mac-dmg

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
	@echo "  dev-frontend     Run Vite dev server (proxies /api to VITE_API_PROXY_TARGET or PULSO_PORT)"
	@echo "  dev-electron-vite Run Electron against Vite HMR; optional PULSO=/path/project.pulso"
	@echo "  visual-qa        Run reusable Playwright visual QA against a route/project"
	@echo "  ui-quick-check   Fast Playwright UI check; starts free ports and optional PULSO project"
	@echo "  monitoreo-qa     Run visual QA for /monitoreo with a .pulso project"
	@echo "  build            Build the frontend into api/inst/www"
	@echo "  desktop-fast     Run Electron, rebuilding frontend only if stale"
	@echo "  audit-reference-build Generate the canonical audit .pulso"
	@echo "  audit-reference-run   Run dev stack with an isolated audit project copy"
	@echo "  desktop-audit         Run Electron with the audit project + CDP smoke port"
	@echo "  audit-reference-smoke Capture canonical audit screenshots from Electron"
	@echo "  package-local    Generate distributable in dist.nosync/Prosecnur/"
	@echo "  package-windows-self-contained Generate offline Windows bundle ZIP + Setup.exe + latest.yml"
	@echo "  package-mac-dmg  Generate macOS .dmg (arm64 + x64) + latest-mac.yml"
	@echo "  clean            Remove build output"
	@echo ""
	@echo "Release flow:"
	@echo "  1. Bumpear Version: en api/DESCRIPTION (fuente unica de verdad)"
	@echo "  2. make package-windows-self-contained   # genera Setup.exe + latest.yml"
	@echo "  3. make package-mac-dmg                  # genera .dmg + latest-mac.yml"
	@echo "  4. gh release create v<version> dist.nosync/Prosecnur-Setup.exe \\"
	@echo "       dist.nosync/latest.yml \\"
	@echo "       dist.nosync/mac-builder-output/*.dmg \\"
	@echo "       dist.nosync/mac-builder-output/latest-mac.yml \\"
	@echo "       --title \"Prosecnur <version>\" --notes \"...\""
	@echo "  Las apps instaladas detectan el release nuevo automaticamente."

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

# Arranca API + frontend con un .pulso ya cargado en una sesión bootstrap.
# Útil para que un agente externo (Claude Code, scripts) verifique cambios
# end-to-end sin abrir manualmente el proyecto desde la UI. El backend
# carga `load_pulso(PULSO)` y expone el sid vía /api/system/bootstrap;
# el frontend lo consume en su primer arranque.
# Uso: make dev-pulso PULSO=/ruta/al/proyecto.pulso
dev-pulso:
	@test -n "$(PULSO)" || (echo "uso: make dev-pulso PULSO=/ruta/al/proyecto.pulso"; exit 1)
	@test -f "$(PULSO)" || (echo "no existe el archivo: $(PULSO)"; exit 1)
	PULSO_BOOTSTRAP_PROJECT="$(PULSO)" PULSO_OPEN_BROWSER=false $(MAKE) -j2 dev-api dev-frontend

dev-electron-vite:
	@if [ -n "$(PULSO)" ] && [ ! -f "$(PULSO)" ]; then \
	  echo "no existe el archivo: $(PULSO)"; \
	  exit 1; \
	fi
	@set -e; \
	  echo "[Prosecnur] Vite: $(PROSECNUR_VITE_URL) -> API http://127.0.0.1:$(PULSO_PORT)"; \
	  cd "$(REPO_ROOT)/frontend"; \
	  VITE_DEV_PORT="$(VITE_DEV_PORT)" \
	  PULSO_PORT="$(PULSO_PORT)" \
	  VITE_API_PROXY_TARGET="http://127.0.0.1:$(PULSO_PORT)" \
	  pnpm dev -- --host 127.0.0.1 & \
	  vite_pid=$$!; \
	  cleanup() { \
	    kill $$vite_pid 2>/dev/null || true; \
	    wait $$vite_pid 2>/dev/null || true; \
	  }; \
	  trap cleanup EXIT INT TERM; \
	  sleep 1; \
	  if ! kill -0 $$vite_pid 2>/dev/null; then \
	    wait $$vite_pid; \
	  fi; \
	  if [ -n "$(PULSO)" ]; then \
	    export PULSO_BOOTSTRAP_PROJECT="$(PULSO)"; \
	  fi; \
	  cd "$(REPO_ROOT)/desktop"; \
	  env -u ELECTRON_RUN_AS_NODE \
	    PROSECNUR_ELECTRON_DEV=1 \
	    PROSECNUR_VITE_URL="$(PROSECNUR_VITE_URL)" \
	    PULSO_PORT="$(PULSO_PORT)" \
	    PULSO_BOOTSTRAP_PROJECT="$${PULSO_BOOTSTRAP_PROJECT:-}" \
	    pnpm start

visual-qa:
	@node scripts/visual-qa.mjs \
	  --url "$(QA_URL)" \
	  --api "$(QA_API)" \
	  --out "$(QA_OUT)" \
	  $(if $(PULSO),--project "$(PULSO)",) \
	  $(QA_ARGS)

ui-quick-check:
	@node scripts/ui-quick-check.mjs \
	  $(if $(PULSO),--project "$(PULSO)",) \
	  $(UI_QA_ARGS)

monitoreo-qa:
	@test -n "$(PULSO)" || (echo "uso: make monitoreo-qa PULSO=/ruta/al/proyecto.pulso [QA_API=auto]"; exit 1)
	@$(MAKE) visual-qa \
	  QA_URL="http://localhost:5173/monitoreo" \
	  QA_API="$(QA_API)" \
	  PULSO="$(PULSO)" \
	  QA_ARGS='--wait-selector [data-audit-ready="monitoreo"] $(QA_ARGS)'

audit-reference-build:
	Rscript api/scripts/audit_reference_build.R --out "$(REPO_ROOT)/api/inst/audit_reference" --project "$(AUDIT_PROJECT)"

audit-reference-run: audit-reference-build
	@RUN_MANIFEST="$$(Rscript api/scripts/audit_reference_prepare_run.R --seed "$(AUDIT_PROJECT)" --root "$(AUDIT_RUNS_DIR)")"; \
	  PROJECT="$$(Rscript -e 'cat(jsonlite::fromJSON(commandArgs(TRUE)[1])$$project_path)' "$$RUN_MANIFEST")"; \
	  echo "[audit] run manifest: $$RUN_MANIFEST"; \
	  echo "[audit] project copy: $$PROJECT"; \
	  PULSO_PORT="$(AUDIT_PORT)" \
	  PULSO_BOOTSTRAP_PROJECT="$$PROJECT" \
	  PULSO_AUDIT_PROJECT="$$PROJECT" \
	  PULSO_AUDIT_RUN_MANIFEST="$$RUN_MANIFEST" \
	  PULSO_OPEN_BROWSER=false \
	  VITE_API_PROXY_TARGET="http://127.0.0.1:$(AUDIT_PORT)" \
	  $(MAKE) -j2 dev-api dev-frontend

desktop-audit: audit-reference-build build-if-stale
	@RUN_MANIFEST="$$(Rscript api/scripts/audit_reference_prepare_run.R --seed "$(AUDIT_PROJECT)" --root "$(AUDIT_RUNS_DIR)")"; \
	  PROJECT="$$(Rscript -e 'cat(jsonlite::fromJSON(commandArgs(TRUE)[1])$$project_path)' "$$RUN_MANIFEST")"; \
	  echo "[audit] run manifest: $$RUN_MANIFEST"; \
	  echo "[audit] project copy: $$PROJECT"; \
	  cd desktop && env -u ELECTRON_RUN_AS_NODE \
	    PULSO_PORT="$(AUDIT_PORT)" \
	    PULSO_BOOTSTRAP_PROJECT="$$PROJECT" \
	    PULSO_AUDIT_PROJECT="$$PROJECT" \
	    PULSO_AUDIT_RUN_MANIFEST="$$RUN_MANIFEST" \
	    PULSO_ALLOW_MULTI_INSTANCE=true \
	    PROSECNUR_USER_DATA_DIR="$$(dirname "$$RUN_MANIFEST")/electron-user-data" \
	    PROSECNUR_SMOKE_CDP_PORT="$(AUDIT_CDP_PORT)" \
	    pnpm start

audit-reference-smoke:
	@RUN_MANIFEST="$${PULSO_AUDIT_RUN_MANIFEST:-$$(ls -t "$(AUDIT_RUNS_DIR)"/*/audit-run.json 2>/dev/null | head -1)}"; \
	  test -n "$$RUN_MANIFEST" || (echo "No encontre audit-run.json. Abre primero make desktop-audit."; exit 1); \
	  SCREENSHOT_DIR="$$(dirname "$$RUN_MANIFEST")/screenshots"; \
	  echo "[audit] smoke manifest: $$RUN_MANIFEST"; \
	  PULSO_AUDIT_RUN_MANIFEST="$$RUN_MANIFEST" \
	  PULSO_AUDIT_SCREENSHOT_DIR="$$SCREENSHOT_DIR" \
	  SMOKE_CDP_URL="$${SMOKE_CDP_URL:-http://127.0.0.1:$(AUDIT_CDP_PORT)/json/list}" \
	  node desktop/smoke-electron.mjs

build:
	@started=$$(date +%s); \
	  cd frontend && pnpm build; \
	  cd "$(REPO_ROOT)" && node scripts/frontend-build-status.mjs --stamp; \
	  elapsed=$$(( $$(date +%s) - started )); \
	  echo "✓ Frontend compilado en $${elapsed}s."

build-if-stale:
	@started=$$(date +%s); \
	  status=0; \
	  node scripts/frontend-build-status.mjs --check || status=$$?; \
	  check_elapsed=$$(( $$(date +%s) - started )); \
	  if [ "$$status" = "0" ]; then \
	    echo "✓ Check frontend completado en $${check_elapsed}s."; \
	  elif [ "$$status" = "1" ]; then \
	    echo "→ Compilando frontend de producción..."; \
	    build_started=$$(date +%s); \
	    cd frontend && pnpm build; \
	    cd "$(REPO_ROOT)" && node scripts/frontend-build-status.mjs --stamp; \
	    build_elapsed=$$(( $$(date +%s) - build_started )); \
	    total_elapsed=$$(( $$(date +%s) - started )); \
	    echo "✓ Frontend compilado en $${build_elapsed}s (total $${total_elapsed}s)."; \
	  else \
	    echo "✗ No se pudo evaluar el estado del frontend (codigo $$status)." >&2; \
	    exit "$$status"; \
	  fi

desktop: build
	cd desktop && env -u ELECTRON_RUN_AS_NODE pnpm start

desktop-fast: build-if-stale
	cd desktop && env -u ELECTRON_RUN_AS_NODE pnpm start

package-local: build
	@APP_VERSION=$$(awk -F': *' '/^Version:/ {print $$2; exit}' api/DESCRIPTION); \
	  test -n "$$APP_VERSION" || (echo "ERROR: no pude leer Version: de api/DESCRIPTION"; exit 1); \
	  echo "[Prosecnur] Empaquetando version: $$APP_VERSION"
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
	# Sincroniza la version a Info.plist y desktop/package.json en el staging
	# (no toca los archivos originales del repo).
	@APP_VERSION=$$(awk -F': *' '/^Version:/ {print $$2; exit}' api/DESCRIPTION); \
	  PLIST="$(PACKAGE_STAGING)/Prosecnur.app/Contents/Info.plist"; \
	  /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $$APP_VERSION" "$$PLIST"; \
	  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $$APP_VERSION" "$$PLIST"; \
	  for PKG in "$(PACKAGE_STAGING)/Prosecnur.app/Contents/Resources/Internals/desktop/package.json" "$(PACKAGE_STAGING)/Internals/desktop/package.json"; do \
	    node -e "const fs=require('fs'); const p='$$PKG'; const j=JSON.parse(fs.readFileSync(p)); j.version='$$APP_VERSION'; fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');"; \
	  done
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

package-windows-self-contained:
	bash packaging/windows/build-self-contained.sh

package-mac-dmg:
	bash packaging/macos/build-dmg.sh

clean:
	rm -rf api/inst/www/*
