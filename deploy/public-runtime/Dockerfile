# Runtime minimo para artefactos publicos de Monitoreo.
# No copia el frontend ni la API local completa: solo instala un paquete
# reducido que lee el payload agregado guardado en data/proyecto.pulso.

FROM rocker/r-ver:4.4.1

ENV LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
RUN apt-get update && apt-get install -y --no-install-recommends \
        locales \
        curl \
        libcurl4-openssl-dev \
        libssl-dev \
        libxml2-dev \
        ca-certificates \
    && sed -i '/en_US.UTF-8/s/^# //' /etc/locale.gen && locale-gen \
    && rm -rf /var/lib/apt/lists/*

RUN R -e "options(repos = c(CRAN = 'https://packagemanager.posit.co/cran/__linux__/jammy/latest')); install.packages('pak', Ncpus = parallel::detectCores())"

WORKDIR /app
COPY api/DESCRIPTION /app/api/DESCRIPTION
RUN R -e "pak::pkg_install('deps::./api', upgrade = FALSE)"

COPY api /app/api
COPY launcher /app/launcher
RUN R CMD INSTALL --no-multiarch /app/api

RUN mkdir -p /data
COPY data /data

ENV PORT=7860
EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}/api/system/health" || exit 1

CMD ["Rscript", "/app/launcher/launch_server.R"]
