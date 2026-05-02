# Dockerfile multi-stage para deploy web del Dashboard de Prosecnur.
#
# Compatible con:
#   - Hugging Face Spaces (Docker SDK, $PORT por default 7860)
#   - Fly.io ($PORT inyectado, listen on 0.0.0.0)
#   - VPS / Render / cualquier hosting con Docker
#
# El .pulso bootstrap NO se copia al image (cambia por deploy). Vive en
# /data/proyecto.pulso, montado por el hosting (volume en Fly, o copiado
# por git push en HF Spaces a /code/data/proyecto.pulso si se prefiere
# bundling en la image — ver `Dockerfile.bundled` si se construye).

# --------------------------------------------------------------------
# Stage 1 — Frontend bundle (modo público)
# --------------------------------------------------------------------
FROM node:20-bookworm-slim AS frontend
WORKDIR /build
RUN corepack enable

# Cachear deps: solo package.json + lockfile primero.
COPY frontend/package.json frontend/pnpm-lock.yaml ./frontend/
RUN cd frontend && pnpm install --frozen-lockfile

# Build con flag de modo público — ESTO es lo que oculta admin bar y
# activa noindex en el index.html servido.
COPY frontend ./frontend
ENV VITE_PULSO_PUBLIC_MODE=true
RUN cd frontend && pnpm build
# El build escribe a `../api/inst/www` (configurado en vite.config.ts).
# Como el contexto del COPY es solo `frontend/`, el outDir cae en
# /build/api/inst/www — listo para Stage 2.

# --------------------------------------------------------------------
# Stage 2 — R + Plumber + paquete prosecnurapp
# --------------------------------------------------------------------
FROM rocker/r-ver:4.4.1

# Locale UTF-8 (igual que launch.R local).
ENV LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
RUN apt-get update && apt-get install -y --no-install-recommends \
        locales \
        curl \
        libxml2-dev \
        libssl-dev \
        libcurl4-openssl-dev \
        libfontconfig1-dev \
        libfreetype6-dev \
        libharfbuzz-dev \
        libfribidi-dev \
        libpng-dev \
        libtiff5-dev \
        libjpeg-dev \
        libxt6 \
        zlib1g-dev \
        ca-certificates \
    && sed -i '/en_US.UTF-8/s/^# //' /etc/locale.gen && locale-gen \
    && rm -rf /var/lib/apt/lists/*

# Posit Public Package Manager — binarios pre-compilados Ubuntu = install
# en segundos en vez de minutos. `rocker/r-ver` ya tiene la url base.
RUN R -e "options(repos = c(CRAN = 'https://packagemanager.posit.co/cran/__linux__/jammy/latest')); \
          install.packages(c('pak'), Ncpus = parallel::detectCores())"

# Instalar deps R desde DESCRIPTION ANTES de copiar el código — cachea
# la capa pesada cuando solo cambia el código del paquete.
WORKDIR /app
COPY api/DESCRIPTION /app/api/DESCRIPTION
RUN R -e "pak::pkg_install(c('deps::./api', 'plotly'), upgrade = FALSE)"

# Copiar el paquete completo + frontend bundle del Stage 1.
COPY api /app/api
COPY --from=frontend /build/api/inst/www /app/api/inst/www
COPY launcher /app/launcher

# Instalar el paquete prosecnurapp.
RUN R CMD INSTALL --no-multiarch --with-keep.source /app/api

# Directorio para el .pulso bootstrap. En HF Spaces, el archivo viene
# en el repo (`data/proyecto.pulso`) y se copia al image. En Fly.io
# se puede sobrescribir con un volume montado en /data.
RUN mkdir -p /data
COPY data /data
VOLUME /data

# Puerto del hosting. HF Spaces usa 7860, Fly.io respeta $PORT (default
# en internal_port del fly.toml). launch_server.R lee $PORT con fallback.
ENV PORT=7860
EXPOSE 7860

# Healthcheck (opcional pero útil — Fly y otros lo usan).
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}/api/system/health" || exit 1

# Entrypoint: el launcher ya activa PULSO_PUBLIC_MODE=1.
CMD ["Rscript", "/app/launcher/launch_server.R"]
