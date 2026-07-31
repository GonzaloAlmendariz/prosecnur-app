SHELL := /bin/bash
# Locale fijo para toda receta: los shells no interactivos llegan con LC_CTYPE=C
# y eso rompe el parseo de tildes en R (falso "unexpected input" en archivos
# UTF-8) y el formato de horas que monitoreo-engine espera ("03:15pm").
# Tiene que ser en_US.UTF-8: C rompe tildes y es_ES.UTF-8 da "03:15p. m.".
export LANG := en_US.UTF-8
export LC_ALL := en_US.UTF-8
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
AUDIT_PROJECTS_DIR ?= $(REPO_ROOT)/outputs/audit-projects/seeds
AUDIT_PROJECT_DELIVERABLES_DIR ?= $(REPO_ROOT)/outputs/audit-projects/deliverables
# Proyectos de referencia: estudios REALES anonimizados. A diferencia de las
# semillas sinteticas, viven versionados en api/inst/ y no se generan en cada
# corrida — construirlos necesita los .pulso originales, que no estan en el repo.
REFERENCE_PROJECTS_DIR ?= $(REPO_ROOT)/api/inst/reference_projects
REFERENCE_RUNS_DIR ?= $(REPO_ROOT)/outputs/reference-runs
REFERENCE_PROJECT ?= acnur_acg
PROJECT ?= territorial_lima_manzanas
PULSO_PORT ?= 8787
VITE_DEV_PORT ?= 5173
PROSECNUR_VITE_URL ?= http://localhost:$(VITE_DEV_PORT)
NODE_UV_THREADPOOL_SIZE ?= 64
QA_URL ?= http://localhost:5173/
QA_API ?= auto
QA_OUT ?= $(REPO_ROOT)/outputs/visual-qa/$(shell date +%Y%m%d-%H%M%S)

.PHONY: help dev-api dev-frontend dev-pulso dev-electron-vite dev-status dev-prune visual-qa ui-quick-check vaults-audit vaults-check vaults-index monitoreo-qa audit-reference-build audit-reference-run audit-reference-smoke desktop-audit audit-projects-build audit-project-build audit-project-run audit-project-visual-matrix audit-project-deliverables reference-projects-build reference-project-build reference-project-verify reference-project-seed-aulas reference-project-run reference-project-visual-matrix build build-if-stale build-if-stale-fast dev-port-preflight clean install-r install-frontend install-desktop desktop desktop-fast package-local package-windows-self-contained package-mac-dmg

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
	@echo "  vaults-audit     Report Obsidian vault drift without failing"
	@echo "  vaults-check     Fail when either vault drifts from the live navigation contract"
	@echo "  vaults-index     Regenerate docs/sistema/direcciones from the contract and ## Gobierna"
	@echo "  build            Build the frontend into api/inst/www"
	@echo "  desktop-fast     Run Electron, rebuilding frontend only if stale"
	@echo "  audit-reference-build Generate the canonical audit .pulso"
	@echo "  audit-reference-run   Run dev stack with an isolated audit project copy"
	@echo "  desktop-audit         Run Electron with the audit project + CDP smoke port"
	@echo "  audit-reference-smoke Capture canonical audit screenshots from Electron"
	@echo "  audit-projects-build  Generate all canonical family audit .pulso seeds"
	@echo "  audit-project-build   Generate one family audit seed; use PROJECT=<slug>"
	@echo "  audit-project-run     Run dev stack with one isolated family audit project"
	@echo "  audit-project-visual-matrix Run ui-quick-check across canonical routes"
	@echo "  audit-project-deliverables Generate family deliverables/evidence report"
	@echo "  reference-projects-build   Build all anonymized real-study fixtures"
	@echo "  reference-project-build    Build one fixture; use REFERENCE_PROJECT=<slug>"
	@echo "  reference-project-verify   Gate: no PII + declared coverage holds"
	@echo "  reference-project-seed-aulas Derive a run copy with the aulas selection already run"
	@echo "  reference-project-run      Run dev stack on an isolated fixture copy"
	@echo "  reference-project-visual-matrix Run ui-quick-check across a fixture's routes"
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
	  UV_THREADPOOL_SIZE="$(NODE_UV_THREADPOOL_SIZE)" pnpm dev -- --host 127.0.0.1 & \
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

vaults-audit:
	@node scripts/vaults-check.mjs $(VAULTS_ARGS)

vaults-check:
	@node scripts/vaults-check.mjs --check $(VAULTS_ARGS)

vaults-index:
	@node scripts/vaults-check.mjs --generar

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

audit-projects-build:
	Rscript api/scripts/audit_project_build.R --all --out "$(AUDIT_PROJECTS_DIR)"

audit-project-build:
	@test -n "$(PROJECT)" || (echo "uso: make audit-project-build PROJECT=territorial_lima_manzanas"; exit 1)
	Rscript api/scripts/audit_project_build.R --project "$(PROJECT)" --out "$(AUDIT_PROJECTS_DIR)"

audit-project-run: audit-project-build
	@RUN_MANIFEST="$$(Rscript api/scripts/audit_project_prepare_run.R --project "$(PROJECT)" --seed "$(AUDIT_PROJECTS_DIR)/$(PROJECT)/$(PROJECT).pulso" --root "$(AUDIT_RUNS_DIR)")"; \
	  PROJECT_PATH="$$(Rscript -e 'cat(jsonlite::fromJSON(commandArgs(TRUE)[1])$$project_path)' "$$RUN_MANIFEST")"; \
	  echo "[audit-project] run manifest: $$RUN_MANIFEST"; \
	  echo "[audit-project] project copy: $$PROJECT_PATH"; \
	  PULSO_PORT="$(AUDIT_PORT)" \
	  PULSO_BOOTSTRAP_PROJECT="$$PROJECT_PATH" \
	  PULSO_AUDIT_PROJECT="$$PROJECT_PATH" \
	  PULSO_AUDIT_RUN_MANIFEST="$$RUN_MANIFEST" \
	  PULSO_OPEN_BROWSER=false \
	  VITE_API_PROXY_TARGET="http://127.0.0.1:$(AUDIT_PORT)" \
	  $(MAKE) -j2 dev-api dev-frontend

audit-project-visual-matrix:
	@test -n "$(PROJECT)" || (echo "uso: make audit-project-visual-matrix PROJECT=territorial_lima_manzanas"; exit 1)
	@if [ ! -f "$(AUDIT_PROJECTS_DIR)/$(PROJECT)/$(PROJECT).pulso" ]; then \
	  Rscript api/scripts/audit_project_build.R --project "$(PROJECT)" --out "$(AUDIT_PROJECTS_DIR)"; \
	fi
	@$(MAKE) ui-quick-check \
	  PULSO="$(AUDIT_PROJECTS_DIR)/$(PROJECT)/$(PROJECT).pulso" \
	  UI_QA_ARGS='--route /diseno-estudio --route /plan-trabajo --route /calc-muestra --route /editor-xlsform --route /hojas-ruta --route /recopiladores --route /monitoreo --route /carga --route /validacion --route /codificacion --route /analitica --route /graficos --route /tablero --viewport 1440x900 --viewport 1280x720 --viewport 1024x640 --layout-preset auto --fail-on-issues --prefetch-route-data $(UI_QA_ARGS)'

audit-project-deliverables: audit-project-build
	@test -n "$(PROJECT)" || (echo "uso: make audit-project-deliverables PROJECT=territorial_lima_manzanas"; exit 1)
	Rscript api/scripts/audit_project_deliverables.R --project "$(PROJECT)" --out "$(AUDIT_PROJECT_DELIVERABLES_DIR)/$(PROJECT)" --seed "$(AUDIT_PROJECTS_DIR)/$(PROJECT)/$(PROJECT).pulso"

# --- Proyectos de referencia (estudios reales anonimizados) -------------------
# Construir requiere los .pulso originales del analista y PROSECNUR_ANON_SALT.
# Verificar y correr solo necesitan el fixture ya versionado.

reference-projects-build:
	Rscript api/scripts/reference_project_build.R --all

reference-project-build:
	@test -n "$(REFERENCE_PROJECT)" || (echo "uso: make reference-project-build REFERENCE_PROJECT=acnur_acg"; exit 1)
	Rscript api/scripts/reference_project_build.R --project "$(REFERENCE_PROJECT)"

reference-project-verify:
	Rscript api/scripts/reference_project_verify.R

reference-project-seed-aulas:
	@test -n "$(REFERENCE_PROJECT)" || (echo "uso: make reference-project-seed-aulas REFERENCE_PROJECT=hsvg2026"; exit 1)
	@set -e; \
	  RUN_MANIFEST="$$(Rscript api/scripts/reference_project_seed_aulas_selection.R --project "$(REFERENCE_PROJECT)" --root "$(REFERENCE_RUNS_DIR)")"; \
	  if [ -z "$$RUN_MANIFEST" ] || [ ! -f "$$RUN_MANIFEST" ]; then \
	    echo "[reference] seed_aulas_selection no devolvio un manifiesto valido: '$$RUN_MANIFEST'"; exit 1; \
	  fi; \
	  PROJECT_PATH="$$(Rscript -e 'cat(jsonlite::fromJSON(commandArgs(TRUE)[1])$$project_path)' "$$RUN_MANIFEST")"; \
	  echo "[reference] run manifest: $$RUN_MANIFEST"; \
	  echo "[reference] proyecto con seleccion: $$PROJECT_PATH"; \
	  echo "[reference] abrelo con: /ver-ui o ?pulso=$$PROJECT_PATH"

reference-project-run:
	@test -n "$(REFERENCE_PROJECT)" || (echo "uso: make reference-project-run REFERENCE_PROJECT=acnur_acg"; exit 1)
	@set -e; \
	  RUN_MANIFEST="$$(Rscript api/scripts/reference_project_prepare_run.R --project "$(REFERENCE_PROJECT)" --root "$(REFERENCE_RUNS_DIR)")"; \
	  if [ -z "$$RUN_MANIFEST" ] || [ ! -f "$$RUN_MANIFEST" ]; then \
	    echo "[reference] prepare_run no devolvio un manifiesto valido: '$$RUN_MANIFEST'"; exit 1; \
	  fi; \
	  PROJECT_PATH="$$(Rscript -e 'cat(jsonlite::fromJSON(commandArgs(TRUE)[1])$$project_path)' "$$RUN_MANIFEST")"; \
	  if [ -z "$$PROJECT_PATH" ] || [ ! -f "$$PROJECT_PATH" ]; then \
	    echo "[reference] el manifiesto no trae un project_path usable: '$$PROJECT_PATH'"; exit 1; \
	  fi; \
	  echo "[reference] run manifest: $$RUN_MANIFEST"; \
	  echo "[reference] project copy: $$PROJECT_PATH"; \
	  PULSO_PORT="$(AUDIT_PORT)" \
	  PULSO_BOOTSTRAP_PROJECT="$$PROJECT_PATH" \
	  PULSO_OPEN_BROWSER=false \
	  VITE_API_PROXY_TARGET="http://127.0.0.1:$(AUDIT_PORT)" \
	  $(MAKE) -j2 dev-api dev-frontend

reference-project-visual-matrix:
	@test -n "$(REFERENCE_PROJECT)" || (echo "uso: make reference-project-visual-matrix REFERENCE_PROJECT=acnur_acg"; exit 1)
	@test -f "$(REFERENCE_PROJECTS_DIR)/$(REFERENCE_PROJECT)/$(REFERENCE_PROJECT).pulso" || \
	  (echo "Fixture ausente. Corre: make reference-project-build REFERENCE_PROJECT=$(REFERENCE_PROJECT)"; exit 1)
	@set -e; \
	  RUN_MANIFEST="$$(Rscript api/scripts/reference_project_prepare_run.R --project "$(REFERENCE_PROJECT)" --root "$(REFERENCE_RUNS_DIR)")"; \
	  if [ -z "$$RUN_MANIFEST" ] || [ ! -f "$$RUN_MANIFEST" ]; then \
	    echo "[reference] prepare_run no devolvio un manifiesto valido: '$$RUN_MANIFEST'"; exit 1; \
	  fi; \
	  PROJECT_PATH="$$(Rscript -e 'cat(jsonlite::fromJSON(commandArgs(TRUE)[1])$$project_path)' "$$RUN_MANIFEST")"; \
	  if [ -z "$$PROJECT_PATH" ] || [ ! -f "$$PROJECT_PATH" ]; then \
	    echo "[reference] el manifiesto no trae un project_path usable: '$$PROJECT_PATH'"; exit 1; \
	  fi; \
	  $(MAKE) ui-quick-check \
	    PULSO="$$PROJECT_PATH" \
	    UI_QA_ARGS='--route /diseno-estudio --route /plan-trabajo --route /calc-muestra --route /editor-xlsform --route /hojas-ruta --route /recopiladores --route /monitoreo --route /carga --route /validacion --route /codificacion --route /analitica --route /graficos --route /tablero --viewport 1440x900 --viewport 1280x720 --viewport 1024x640 --layout-preset auto --fail-on-issues --prefetch-route-data $(UI_QA_ARGS)'

build:
	@started=$$(date +%s); \
	  cd frontend && UV_THREADPOOL_SIZE="$(NODE_UV_THREADPOOL_SIZE)" pnpm build && \
	  cd "$(REPO_ROOT)" && node scripts/frontend-build-status.mjs --stamp && \
	  { elapsed=$$(( $$(date +%s) - started )); \
	    echo "✓ Frontend compilado en $${elapsed}s."; }

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
	    cd frontend && UV_THREADPOOL_SIZE="$(NODE_UV_THREADPOOL_SIZE)" pnpm build; \
	    cd "$(REPO_ROOT)" && node scripts/frontend-build-status.mjs --stamp; \
	    build_elapsed=$$(( $$(date +%s) - build_started )); \
	    total_elapsed=$$(( $$(date +%s) - started )); \
	    echo "✓ Frontend compilado en $${build_elapsed}s (total $${total_elapsed}s)."; \
	  else \
	    echo "✗ No se pudo evaluar el estado del frontend (codigo $$status)." >&2; \
	    exit "$$status"; \
	  fi

build-if-stale-fast:
	@started=$$(date +%s); \
	  status=0; \
	  node scripts/frontend-build-status.mjs --check || status=$$?; \
	  check_elapsed=$$(( $$(date +%s) - started )); \
	  if [ "$$status" = "0" ]; then \
	    echo "✓ Check frontend completado en $${check_elapsed}s."; \
	  elif [ "$$status" = "1" ]; then \
	    echo "→ Compilando frontend de desarrollo rápido..."; \
	    build_started=$$(date +%s); \
	    cd frontend && UV_THREADPOOL_SIZE="$(NODE_UV_THREADPOOL_SIZE)" pnpm build:fast; \
	    cd "$(REPO_ROOT)" && node scripts/frontend-build-status.mjs --stamp; \
	    build_elapsed=$$(( $$(date +%s) - build_started )); \
	    total_elapsed=$$(( $$(date +%s) - started )); \
	    echo "✓ Frontend dev compilado en $${build_elapsed}s (total $${total_elapsed}s)."; \
	    echo "ℹ Typecheck estricto omitido en desktop-fast; usa 'pnpm --dir frontend typecheck' o 'make build' para release."; \
	  else \
	    echo "✗ No se pudo evaluar el estado del frontend (codigo $$status)." >&2; \
	    exit "$$status"; \
	  fi

dev-port-preflight:
	@node scripts/dev-port-preflight.mjs --ports 8787,8788,8789

# Higiene de servers dev: inventario y limpieza de vites huérfanos/stale.
# Nunca toca el backend R (8787).
dev-status:
	@bash scripts/dev-servers.sh status

dev-prune:
	@bash scripts/dev-servers.sh prune

desktop: build
	cd desktop && env -u ELECTRON_RUN_AS_NODE pnpm start

desktop-fast: dev-port-preflight build-if-stale-fast
	cd desktop && env -u ELECTRON_RUN_AS_NODE pnpm start

package-local: build-if-stale
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
	bash scripts/copy-tree.sh Prosecnur.app "$(PACKAGE_STAGING)/Prosecnur.app" ".DS_Store"
	# Fuentes embebidas dentro del .app (modo packaged usa Resources/Internals).
	bash scripts/copy-tree.sh api "$(PACKAGE_STAGING)/Prosecnur.app/Contents/Resources/Internals/api" ".DS_Store" "tests"
	bash scripts/copy-tree.sh launcher "$(PACKAGE_STAGING)/Prosecnur.app/Contents/Resources/Internals/launcher" ".DS_Store"
	bash scripts/copy-tree.sh desktop "$(PACKAGE_STAGING)/Prosecnur.app/Contents/Resources/Internals/desktop" ".DS_Store" "node_modules"
	# Fuentes para el launcher Windows (.bat). Las espeja al lado del .bat.
	cp Prosecnur.bat "$(PACKAGE_STAGING)/Prosecnur.bat"
	bash scripts/copy-tree.sh api "$(PACKAGE_STAGING)/Internals/api" ".DS_Store" "tests"
	bash scripts/copy-tree.sh launcher "$(PACKAGE_STAGING)/Internals/launcher" ".DS_Store"
	bash scripts/copy-tree.sh desktop "$(PACKAGE_STAGING)/Internals/desktop" ".DS_Store" "node_modules"
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
