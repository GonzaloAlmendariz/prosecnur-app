# =============================================================================
# Tema visual de reporte_interactivo()
# - CSS parametrizable
# - JS navbar pill
# - Paleta de colores de la app
# =============================================================================

`%||%` <- get0("%||%", ifnotfound = function(x, y) if (!is.null(x)) x else y)

# -----------------------------------------------------------------------------
# Paleta visual por defecto
# -----------------------------------------------------------------------------

reporte_interactivo_theme_default <- function() {
  list(
    color_primario      = "#002457",
    color_fondo_app     = "#f5f6fa",
    color_borde         = "#e6e9f2",
    color_texto         = "#1f2933",
    color_texto_suave   = "#5f6b7a",
    color_superficie    = "#ffffff",
    color_superficie_2  = "#fafbff",
    color_header_tabla  = "#f1f3f9"
  )
}

# -----------------------------------------------------------------------------
# Helpers internos de tema
# -----------------------------------------------------------------------------

.css_escape <- function(x) {
  x <- as.character(x)[1]
  x <- gsub("\\\\", "\\\\\\\\", x)
  x <- gsub("\"", "\\\\\"", x)
  x
}

.theme_merge <- function(theme_app = NULL) {
  base <- reporte_interactivo_theme_default()
  if (is.null(theme_app)) return(base)

  nm <- intersect(names(theme_app), names(base))
  if (length(nm)) {
    base[nm] <- theme_app[nm]
  }
  base
}

# -----------------------------------------------------------------------------
# CSS de la app
# -----------------------------------------------------------------------------

reporte_interactivo_theme_css <- function(theme_app = NULL) {

  th <- .theme_merge(theme_app)

  color_primario     <- .css_escape(th$color_primario)
  color_fondo_app    <- .css_escape(th$color_fondo_app)
  color_borde        <- .css_escape(th$color_borde)
  color_texto        <- .css_escape(th$color_texto)
  color_texto_suave  <- .css_escape(th$color_texto_suave)
  color_superficie   <- .css_escape(th$color_superficie)
  color_superficie_2 <- .css_escape(th$color_superficie_2)
  color_header_tabla <- .css_escape(th$color_header_tabla)

  shadow_soft <- "rgba(0, 36, 87, 0.06)"
  shadow_med  <- "rgba(0, 36, 87, 0.07)"
  shadow_low  <- "rgba(0, 36, 87, 0.04)"
  focus_ring  <- "rgba(0, 36, 87, 0.15)"
  prim_005    <- "rgba(0, 36, 87, 0.05)"
  prim_006    <- "rgba(0, 36, 87, 0.06)"
  prim_020    <- "rgba(0, 36, 87, 0.20)"
  prim_035    <- "rgba(0, 36, 87, 0.35)"
  prim_085    <- "rgba(230, 233, 242, 0.85)"
  pill_border <- "rgba(0, 36, 87, 0.10)"

  css <- "
/* ============================================================
   ====== Base ======
   ============================================================ */
html, body { min-height: 100%; }
* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
body {
  background:
    radial-gradient(1150px 520px at -8% -12%, rgba(0,36,87,0.10), transparent 58%),
    radial-gradient(920px 420px at 104% -4%, rgba(0,36,87,0.08), transparent 62%),
    linear-gradient(180deg, rgba(255,255,255,0.74), rgba(245,248,255,0.92)),
    __COLOR_FONDO_APP__;
  background-attachment: fixed;
  color: __COLOR_TEXTO__;
  padding-top: 10px;
}
.container-fluid { max-width: 1480px; padding-left: 16px; padding-right: 16px; }

/* ============================================================
   ====== Tipografía ======
   ============================================================ */
h2, h3, h4 {
  font-weight: 800;
  color: __COLOR_PRIMARIO__;
  letter-spacing: 0.01em;
}
.title {
  font-weight: 900;
  color: __COLOR_PRIMARIO__;
  letter-spacing: 0.005em;
}

/* ============================================================
   ====== Sidebar ======
   ============================================================ */
.well, .sidebarPanel {
  background: linear-gradient(175deg, rgba(255,255,255,0.96), rgba(247,251,255,0.90)) !important;
  border: 1px solid rgba(221, 228, 242, 0.92) !important;
  border-radius: 20px !important;
  box-shadow: 0 14px 30px rgba(6,31,76,0.08), inset 0 1px 0 rgba(255,255,255,0.75);
  overflow: visible !important;
  position: relative;
  z-index: 60;
}
.sidebar,
.sidebar-panel-base{
  position: relative;
  z-index: 60;
}
.sidebar h3 { margin-top: 0; color: __COLOR_PRIMARIO__; }
.sidebar p  { color: __COLOR_TEXTO_SUAVE__; font-size: 13px; }
.sidebar hr { border-top: 1px solid #edf0f7; }

/* ============================================================
   ====== Sidebar Módulos (Tab 3) ======
   ============================================================ */
.sidebar-panel-base { padding-top: 12px !important; }
.sidebar-stack{
  display:flex;
  flex-direction:column;
  gap:14px;
}
.sidebar-module{
  position: relative;
  border:1px solid rgba(223, 229, 242, 0.92);
  border-radius:16px;
  background: linear-gradient(165deg, rgba(255,255,255,0.97), rgba(248,251,255,0.92));
  padding:11px 11px 13px 11px;
  box-shadow: 0 10px 24px __SHADOW_LOW__;
  overflow: hidden;
}
.sidebar-module::after{
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(255,255,255,0.28), transparent 34%);
}
.sidebar-module-title{
  font-size:24px;
  font-weight:800;
  color:__COLOR_PRIMARIO__;
  line-height:1.1;
  text-transform: none;
  letter-spacing: normal;
  margin:0 0 10px 0;
}
.sidebar-module-help{
  margin:0 0 11px 0 !important;
  font-size:12px !important;
  color:__COLOR_TEXTO_SUAVE__ !important;
  line-height:1.35;
}
.sidebar-module-card{
  border:1px solid rgba(223, 229, 242, 0.92);
  border-radius:12px;
  padding:11px;
  background: rgba(255,255,255,0.90);
}
.sidebar-module-rel .sidebar-module-card .form-group:last-child{
  margin-bottom:0;
}
.sidebar-module-rel{
  overflow: visible;
  z-index: 12;
}
.sidebar-module-rel::after{
  z-index: 0;
}
.sidebar-module-rel > *{
  position: relative;
  z-index: 1;
}
.sidebar-module-rel .sidebar-module-card{
  overflow: visible;
}
.sidebar-module-rel .form-group{
  overflow: visible;
}
.sidebar-module-rel .selectize-input{
  min-height: 38px !important;
  height: auto !important;
  overflow: visible !important;
  white-space: normal !important;
  text-overflow: clip !important;
}
.sidebar-module-rel .selectize-control.single .selectize-input,
.sidebar-module-rel .selectize-control.single .selectize-input.input-active{
  min-height: 38px !important;
  height: auto !important;
  white-space: normal !important;
  line-height: 1.25 !important;
  padding-top: 8px !important;
  padding-bottom: 8px !important;
  padding-right: 30px !important;
}
.sidebar-module-rel .selectize-control.single .selectize-input:after{
  top:50% !important;
  transform: translateY(-50%);
  right:10px !important;
}
.sidebar-module-rel .selectize-control.single .selectize-input > input{
  width:100% !important;
}
.sidebar-module-rel .selectize-input .item{
  display:block !important;
  max-width:100%;
  white-space: normal !important;
  word-break: break-word;
  overflow-wrap:anywhere;
  line-height: 1.25;
}
.sidebar-module-rel .selectize-control{
  overflow: visible !important;
}
.sidebar-module-rel .selectize-dropdown .option{
  white-space: normal !important;
  word-break: break-word;
  line-height: 1.25;
}
.sidebar-module-rel .selectize-dropdown{
  z-index: 18000 !important;
  min-width: 100% !important;
  max-width: 560px !important;
}
.sidebar-module-rel .checkbox{
  margin-top: 2px;
  margin-bottom: 8px;
}
.sidebar-module-rel .checkbox label{
  font-size: 12px;
  font-weight: 800;
  color: __COLOR_PRIMARIO__;
}
.rel-iter-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-top: 2px;
  margin-bottom: 8px;
}
.rel-iter-head-title{
  margin:0 !important;
}
.rel-iter-head-switch{
  flex:0 0 auto;
  margin:0 !important;
}
.rel-sidebar-card-gap{
  margin-top:10px;
}
.rel-sidebar-hint{
  margin:2px 0 0 0 !important;
  font-size:11.5px !important;
}
.rel-iter-hint{
  margin-top:8px;
  margin-bottom:0;
  font-size:11.5px;
  line-height:1.35;
  color:__COLOR_TEXTO_SUAVE__;
  border:1px dashed rgba(0,36,87,0.18);
  border-radius:10px;
  padding:7px 9px;
  background:linear-gradient(180deg, rgba(255,255,255,0.88), rgba(245,248,255,0.84));
}
.sidebar-quick-actions{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:8px;
  margin-top:8px;
}
.sidebar-quick-btn{
  width:100%;
  font-size:11px !important;
  font-weight:800 !important;
  padding:7px 5px !important;
  border-radius:10px !important;
  border-color: rgba(0,36,87,0.15) !important;
  background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(242,246,255,0.96)) !important;
  transition: all .18s ease;
}
.sidebar-quick-btn:hover{
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(0,36,87,0.08);
}
.sidebar-filter-row{
  border:1px solid rgba(214, 223, 238, 0.95);
  border-radius:11px;
  padding:9px;
  margin-top:8px;
  background:rgba(255,255,255,0.78);
}
.sidebar-filter-row-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  margin-bottom:5px;
}
.sidebar-filter-row-title{
  font-size:11px;
  font-weight:800;
  color:__COLOR_PRIMARIO__;
  letter-spacing:.02em;
}
.sidebar-filter-remove-btn{
  border:1px solid rgba(0,36,87,0.16) !important;
  background:rgba(255,255,255,0.92) !important;
  color:__COLOR_PRIMARIO__ !important;
  border-radius:999px !important;
  width:22px !important;
  height:22px !important;
  padding:0 !important;
  line-height:20px !important;
  font-size:10px !important;
}
.sidebar-filter-remove-btn:hover{
  background:rgba(242,247,255,0.98) !important;
}
.sidebar-filter-active-wrap{
  margin-top:8px;
}
.sidebar-filter-active-title{
  font-size:11px;
  font-weight:800;
  color:__COLOR_TEXTO_SUAVE__;
  margin:0 0 6px 0;
}
.sidebar-filter-active-list{
  display:flex;
  flex-wrap:wrap;
  gap:6px;
}
.sidebar-filter-chip{
  display:inline-flex;
  align-items:center;
  gap:6px;
  border:1px solid rgba(0,36,87,0.15);
  background:rgba(255,255,255,0.90);
  border-radius:999px;
  padding:3px 7px;
  max-width:100%;
}
.sidebar-filter-chip-text{
  font-size:10.6px;
  font-weight:700;
  color:__COLOR_TEXTO__;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.sidebar-filter-chip-remove{
  border:0 !important;
  background:transparent !important;
  color:__COLOR_PRIMARIO__ !important;
  width:14px !important;
  height:14px !important;
  min-width:14px !important;
  padding:0 !important;
  font-size:9px !important;
  line-height:12px !important;
  box-shadow:none !important;
}
.sidebar-filter-chip-remove:hover{
  color:__COLOR_TEXTO__ !important;
}
.sidebar-collapse-toggle{
  display:flex;
  flex-direction:column;
  gap:3px;
  width:100%;
  text-decoration:none !important;
  border:1px solid rgba(223, 229, 242, 0.9);
  border-radius:12px;
  padding:10px 12px 11px 12px;
  color:__COLOR_PRIMARIO__ !important;
  font-weight:900;
  background: linear-gradient(180deg, rgba(255,255,255,0.95), rgba(245,248,255,0.89));
  box-shadow: 0 10px 20px __SHADOW_LOW__;
}
.sidebar-collapse-sub{
  font-size:11px;
  font-weight:700;
  color:__COLOR_TEXTO_SUAVE__;
  display:block;
  opacity:0.95;
}
.sidebar-subtitle{
  margin-top:5px;
  margin-bottom:7px;
  font-size:12px;
  font-weight:800;
  color:__COLOR_PRIMARIO__;
  text-transform: none;
  letter-spacing: 0.01em;
}
.vars-section-block{
  border:1px solid rgba(225, 232, 245, 0.95);
  border-radius:12px;
  background:rgba(255,255,255,0.92);
  margin-bottom:8px;
  overflow:hidden;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.82);
}
.vars-section-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  padding:8px 10px 9px 10px;
  background:linear-gradient(180deg, rgba(246,249,255,0.95), rgba(242,246,253,0.92));
  border-bottom: 1px solid rgba(232, 238, 248, 0.9);
}
.vars-section-head .checkbox{
  margin:0;
}
.vars-section-head .checkbox label{
  font-size:13px;
  font-weight:700;
  color:__COLOR_TEXTO__;
}
.vars-section-head input[type='checkbox']{
  margin-top:0;
}
.vars-section-expand{
  font-size:11px;
  font-weight:800;
  color:__COLOR_PRIMARIO__ !important;
  text-decoration:none !important;
  white-space:nowrap;
  border:1px solid rgba(0,36,87,0.12);
  border-radius:999px;
  padding:4px 8px;
  background:rgba(255,255,255,0.82);
}
.vars-section-panel{
  padding:8px 10px 9px 10px;
}
.vars-section-panel .checkbox{
  margin-top:2px;
  margin-bottom:5px;
}
.vars-section-panel .checkbox label{
  font-size:12px;
  font-weight:700;
  color:__COLOR_TEXTO__;
}
.sidebar-collapse-toggle[aria-expanded='true'] .sidebar-collapse-sub{
  opacity:0.95;
}
.sidebar-collapse-panel{
  margin-top:9px;
  border:1px solid rgba(223, 229, 242, 0.92);
  border-radius:12px;
  padding:11px 11px 12px 11px;
  background:rgba(255,255,255,0.92);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.85);
}
.sidebar-module-download .sidebar-collapse-panel{
  margin-top: 0;
}
.sidebar-download-controls{
  display:flex;
  flex-wrap:nowrap;
  gap:10px;
  align-items:flex-end;
}
.sidebar-download-format{
  flex:1 1 auto;
  min-width:0;
}
.sidebar-download-format .form-group{
  margin-bottom:0;
}
.sidebar-download-action{
  flex:0 0 auto;
  display:flex;
  align-items:flex-end;
}
.sidebar-download-action .shiny-html-output,
.sidebar-download-action .shiny-download-link{
  margin:0;
}
.sidebar-download-summary{
  margin-top:8px;
  margin-bottom:8px;
  border:1px solid rgba(223, 229, 242, 0.95);
  border-radius:10px;
  padding:9px 10px;
  background: linear-gradient(180deg, rgba(250,252,255,0.93), rgba(244,248,255,0.9));
}
.sidebar-download-summary-empty{
  font-size:12px;
  font-weight:700;
  color:__COLOR_TEXTO_SUAVE__;
}
.sidebar-download-stat{
  font-size:12px;
  font-weight:800;
  color:__COLOR_PRIMARIO__;
}
.sidebar-download-note{
  margin-top:4px;
  font-size:11px;
  line-height:1.3;
  color:__COLOR_TEXTO_SUAVE__;
}
.sidebar-download-btn{
  width:100%;
  min-width:132px;
  font-weight:900 !important;
  font-size:12px !important;
  padding:8px 12px !important;
  border-color: rgba(0,36,87,0.16) !important;
  background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(241,246,255,0.96)) !important;
}
.sidebar-download-btn:hover{
  box-shadow: 0 8px 16px rgba(0,36,87,0.10);
  transform: translateY(-1px);
}
.sidebar-download-btn.is-disabled,
.rel-download-btn.is-disabled{
  opacity:0.56;
  cursor:not-allowed !important;
  box-shadow:none !important;
  transform:none !important;
}
.sidebar-download-btn.is-disabled:hover,
.rel-download-btn.is-disabled:hover{
  box-shadow:none !important;
  transform:none !important;
}
.dt-toolbar{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-bottom:10px;
  padding:8px 10px;
  border:1px solid rgba(223,229,242,0.88);
  border-radius:12px;
  background: linear-gradient(180deg, rgba(255,255,255,0.82), rgba(246,249,255,0.84));
}
.dt-toolbar-left{
  display:flex;
  align-items:center;
  gap:10px;
}
.dt-toolbar-right{
  margin-left:auto;
}
.dt-toolbar-right .dataTables_filter{
  margin:0 !important;
}
.dt-toolbar-right .dataTables_filter label{
  margin:0 !important;
  font-weight:800;
  color:__COLOR_TEXTO_SUAVE__;
}
.dt-toolbar-right .dataTables_filter input{
  margin-left:8px !important;
  border:1px solid rgba(223,229,242,0.95) !important;
  border-radius:10px !important;
  padding:6px 10px !important;
  background: rgba(255,255,255,0.94) !important;
}
.dt-reset-btn{
  font-size:12px !important;
  font-weight:800 !important;
  padding:6px 11px !important;
  border-color: rgba(0,36,87,0.16) !important;
  background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(243,247,255,0.95)) !important;
}
.dt-dicc-btn{
  width:34px !important;
  height:34px !important;
  min-width:34px !important;
  flex: 0 0 34px;
  aspect-ratio: 1 / 1;
  padding:0 !important;
  border-radius:50% !important;
  display:inline-flex !important;
  align-items:center;
  justify-content:center;
  background: __COLOR_PRIMARIO__ !important;
  border-color: __COLOR_PRIMARIO__ !important;
  color: #ffffff !important;
  box-shadow: 0 8px 16px rgba(0,36,87,0.18);
}
.dt-dicc-btn .glyphicon{
  font-size:14px;
  line-height:1;
}
.dt-dicc-btn:hover,
.dt-dicc-btn.is-active{
  background: #0b3d84 !important;
  border-color: #0b3d84 !important;
  color: #ffffff !important;
  transform: translateY(-1px);
}
.dictionary-popover{
  position:absolute;
  top:66px;
  left:12px;
  width:min(460px, calc(100% - 24px));
  z-index:40;
  opacity:0;
  transform: translateY(-8px) scale(0.985);
  pointer-events:none;
  transition: opacity .2s ease, transform .22s ease;
}
.dictionary-popover.is-open{
  opacity:1;
  transform: translateY(0) scale(1);
  pointer-events:auto;
}
.dictionary-popover-header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  padding:10px 12px;
  border:1px solid rgba(223,229,242,0.92);
  border-bottom:none;
  border-top-left-radius:14px;
  border-top-right-radius:14px;
  background: rgba(255,255,255,0.995);
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
}
.dictionary-popover-title{
  font-size:13px;
  font-weight:900;
  color:__COLOR_PRIMARIO__;
}
.dictionary-popover-close{
  border:none;
  background:transparent;
  color:__COLOR_PRIMARIO__;
  font-size:20px;
  font-weight:800;
  line-height:1;
  padding:0 2px;
  cursor:pointer;
}
.dictionary-popover-body{
  border:1px solid rgba(223,229,242,0.92);
  border-bottom-left-radius:14px;
  border-bottom-right-radius:14px;
  background: rgba(255,255,255,0.985);
  box-shadow: 0 16px 30px rgba(6,31,76,0.12);
  padding:10px 12px 12px 12px;
}
.dictionary-popover-card{
  border:1px solid rgba(223,229,242,0.9);
  border-radius:12px;
  background: rgba(255,255,255,0.93);
  padding:10px;
}
.table-empty-hint{
  border:1px dashed #d9e0ee;
  border-radius:14px;
  padding:28px 16px;
  background: linear-gradient(180deg, rgba(251,253,255,0.95), rgba(244,248,255,0.9));
  text-align:center;
}
.table-empty-title{
  font-size:14px;
  font-weight:900;
  color:__COLOR_PRIMARIO__;
}
.table-empty-subtitle{
  margin-top:4px;
  font-size:12px;
  color:__COLOR_TEXTO_SUAVE__;
}
.summary-empty-hint,
.kpi-empty-hint{
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  width:100%;
  box-sizing:border-box;
}
.summary-empty-hint{
  min-height:84px;
  height:84px;
  padding:12px 14px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.82);
}
.summary-empty-hint .table-empty-title{
  font-size:12.5px;
}
.summary-empty-hint .table-empty-subtitle{
  max-width:280px;
  margin-left:auto;
  margin-right:auto;
  font-size:10.8px;
  line-height:1.35;
}
.kpi-empty-hint{
  padding:22px 14px;
  min-height:132px;
}

/* ============================================================
   ====== Inputs ======
   ============================================================ */
.selectize-input, .form-control {
  border-radius: 12px !important;
  border: 1px solid rgba(220, 227, 241, 0.95) !important;
  box-shadow: none !important;
  font-size: 13px;
  background: rgba(255,255,255,0.94) !important;
}
.selectize-input.focus, .form-control:focus {
  border-color: __COLOR_PRIMARIO__ !important;
  box-shadow: 0 0 0 3px __FOCUS_RING__ !important;
}
.selectize-dropdown,
.selectize-dropdown-content{
  border-radius: 12px !important;
}
.selectize-dropdown{
  border: 1px solid rgba(220, 227, 241, 0.95) !important;
  box-shadow: 0 12px 24px rgba(0, 36, 87, 0.10) !important;
  z-index: 30000 !important;
}

/* ============================================================
   ====== Botones ======
   ============================================================ */
.btn {
  border-radius: 12px !important;
  border: 1px solid rgba(220, 227, 241, 0.95) !important;
  background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(244,248,255,0.95)) !important;
  font-weight: 700;
  color: __COLOR_PRIMARIO__ !important;
  transition: all .18s ease;
}
.btn:hover {
  background: linear-gradient(180deg, rgba(255,255,255,1), rgba(238,244,255,0.95)) !important;
  border-color: __COLOR_PRIMARIO__ !important;
  transform: translateY(-1px);
}

/* ============================================================
   ====== Cards ======
   ============================================================ */
.cardbox {
  background: linear-gradient(180deg, rgba(255,255,255,0.97), rgba(248,252,255,0.93));
  border: 1px solid rgba(221, 228, 242, 0.92);
  border-radius: 22px;
  box-shadow: 0 16px 36px rgba(6,31,76,0.09), inset 0 1px 0 rgba(255,255,255,0.72);
  padding: 12px;
}
.cardbox-data{
  min-height: 760px;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: visible;
}
.cardbox-data .cardbox-header{
  flex: 0 0 auto;
}
.cardbox-data .table-empty-hint,
.cardbox-data .dataTables_wrapper{
  flex: 1 1 auto;
}

/* ============================================================
   ====== Layout spacing ======
   ============================================================ */
.row { margin-left: -10px; margin-right: -10px; }
.col-sm-6, .col-sm-12, .col-sm-9, .col-sm-3 { padding-left: 10px; padding-right: 10px; }

/* ============================================================
   ====== Header con logo ======
   ============================================================ */
.topbar{
  background:linear-gradient(180deg, rgba(255,255,255,0.94), rgba(246,250,255,0.88));
  border:1px solid rgba(223,229,242,0.92);
  border-radius:22px;
  box-shadow:0 16px 36px rgba(6,31,76,0.10), inset 0 1px 0 rgba(255,255,255,0.70);
  padding:17px 19px;
  margin-top: 6px;
  margin-bottom:14px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
}
.topbar-title{
  font-size:28px;
  font-weight:900;
  color:__COLOR_PRIMARIO__;
  line-height:1.12;
  flex: 1 1 auto;
  padding-top: 2px;
}
.topbar-logo{
  height:52px;
  max-width:240px;
  object-fit:contain;
  display:block;
  flex: 0 0 auto;
  margin-right: 2px;
}

/* ============================================================
   ====== Glassy Enhancement + Safari Fallback ======
   ============================================================ */
@supports ((-webkit-backdrop-filter: blur(12px)) or (backdrop-filter: blur(12px))) {
  .topbar,
  .cardbox,
  .well,
  .sidebarPanel,
  .navbar .nav.navbar-nav,
  .sidebar-module,
  .sidebar-module-card,
  .sidebar-collapse-toggle,
  .sidebar-collapse-panel {
    background: linear-gradient(160deg, rgba(255,255,255,0.66), rgba(245,250,255,0.50)) !important;
    border-color: rgba(255,255,255,0.70) !important;
    box-shadow: 0 16px 32px rgba(6, 31, 76, 0.11), inset 0 1px 0 rgba(255,255,255,0.75) !important;
    -webkit-backdrop-filter: blur(26px) saturate(195%) contrast(104%);
    backdrop-filter: blur(26px) saturate(195%) contrast(104%);
    transform: translateZ(0);
  }
}

@supports not ((-webkit-backdrop-filter: blur(12px)) or (backdrop-filter: blur(12px))) {
  .topbar,
  .cardbox,
  .well,
  .sidebarPanel,
  .navbar .nav.navbar-nav,
  .sidebar-module,
  .sidebar-module-card,
  .sidebar-collapse-toggle,
  .sidebar-collapse-panel {
    background: linear-gradient(160deg, rgba(255,255,255,0.98), rgba(244,248,255,0.98)) !important;
    border-color: rgba(217,224,238,0.92) !important;
    box-shadow: 0 12px 26px rgba(6, 31, 76, 0.09), inset 0 1px 0 rgba(255,255,255,0.65) !important;
  }
}

@supports (-webkit-touch-callout: none) {
  .topbar,
  .cardbox,
  .well,
  .sidebarPanel,
  .navbar .nav.navbar-nav,
  .sidebar-module,
  .sidebar-module-card,
  .sidebar-collapse-toggle,
  .sidebar-collapse-panel {
    -webkit-backdrop-filter: blur(24px) saturate(200%) contrast(104%);
    backdrop-filter: blur(24px) saturate(200%) contrast(104%);
  }
}

/* ============================================================
   ====== Card header (editorial) ======
   ============================================================ */
.cardbox-header{
  padding:10px 12px 6px 12px;
  border-bottom:1px solid #edf0f7;
  margin:-12px -12px 10px -12px;
}
.cardbox-title{
  font-size:18px;
  font-weight:900;
  color:__COLOR_PRIMARIO__;
  line-height:1.15;
  margin:0;
}
.section-title-inline{
  display:flex;
  align-items:center;
  gap:10px;
  flex-wrap:wrap;
}
.section-title-prefix{
  white-space:nowrap;
}
.section-title-select{
  min-width:240px;
  max-width:520px;
  flex:1 1 300px;
}
.section-title-select .form-group{
  margin:0 !important;
}
.section-title-select .selectize-control.single .selectize-input,
.section-title-select .selectize-control.single .selectize-input.input-active{
  min-height:34px !important;
  border-radius:10px !important;
  font-size:18px !important;
  font-weight:800 !important;
  color:__COLOR_PRIMARIO__ !important;
  line-height:1.15 !important;
  padding-top:6px !important;
  padding-bottom:6px !important;
  padding-left:10px !important;
}
.section-title-select .selectize-control.single .selectize-input:after{
  border-top-color: __COLOR_PRIMARIO__ !important;
}
.section-title-select .selectize-dropdown{
  z-index:18000 !important;
}
.cardbox-subtitle{
  margin-top:4px;
  font-size:12px;
  color:__COLOR_TEXTO_SUAVE__;
}
.rel-plot-header{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
}
.rel-plot-header-main{
  min-width:0;
  flex:1 1 auto;
}
.rel-plot-header-actions{
  flex:0 0 auto;
  display:flex;
  align-items:center;
  justify-content:flex-end;
}
.rel-plot-header-actions .shiny-html-output{
  margin:0;
}
.rel-iter-level-control{
  display:flex;
  align-items:center;
  gap:8px;
  position:relative;
  overflow:visible;
  z-index:1;
}
.rel-iter-level-control-center{
  justify-content:center;
  width:100%;
}
.dim-focus-wrap{
  display:flex;
  flex-direction:column;
  align-items:flex-end;
  gap:6px;
}
.dim-focus-wrap .toggle-row{
  margin:0;
  gap:8px;
}
.dim-focus-wrap .toggle-label{
  font-size:11px;
}
.rel-iter-circle-btn{
  width:34px !important;
  height:34px !important;
  min-width:34px !important;
  flex:0 0 34px;
  padding:0 !important;
  border-radius:50% !important;
  display:inline-flex !important;
  align-items:center;
  justify-content:center;
  background: __COLOR_PRIMARIO__ !important;
  border-color: __COLOR_PRIMARIO__ !important;
  color:#ffffff !important;
  box-shadow: 0 8px 16px rgba(0,36,87,0.18);
}
.rel-iter-circle-btn .fa{
  font-size:12px;
}
.rel-iter-circle-btn:hover{
  background:#0b3d84 !important;
  border-color:#0b3d84 !important;
  color:#ffffff !important;
  transform: translateY(-1px);
}
.rel-iter-circle-btn:focus{
  box-shadow: 0 0 0 3px rgba(0,36,87,0.20) !important;
}
.rel-iter-level-chip{
  flex:1 1 auto;
  min-width: 150px;
  max-width: 270px;
  border:1px solid rgba(223,229,242,0.92);
  border-radius:999px;
  padding:5px 10px 6px 10px;
  background: linear-gradient(180deg, rgba(255,255,255,0.95), rgba(245,249,255,0.91));
  box-shadow: 0 6px 14px rgba(6,31,76,0.08);
}
.rel-iter-level-name{
  font-size:12px;
  font-weight:900;
  color:__COLOR_PRIMARIO__;
  line-height:1.2;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.rel-iter-level-meta{
  margin-top:1px;
  font-size:10.8px;
  font-weight:700;
  color:__COLOR_TEXTO_SUAVE__;
  line-height:1.1;
}
.iter-popover-wrap{
  position:relative;
  z-index:70;
  overflow:visible;
  isolation:isolate;
}
.iter-popover-wrap.is-open{
  z-index:26000;
}
.iter-popover-wrap.is-open .iter-popover-toggle{
  background:#0b3d84 !important;
  border-color:#0b3d84 !important;
  color:#ffffff !important;
}
.iter-popover-wrap.is-open .rel-iter-level-chip{
  border-color: rgba(0,36,87,0.26);
  box-shadow: 0 10px 22px rgba(6,31,76,0.10);
}
.iter-level-popover{
  position:absolute;
  left:0;
  bottom:calc(100% + 12px);
  width:min(360px, calc(100vw - 56px));
  z-index:26010;
  opacity:0;
  transform: translateY(8px) scale(0.97);
  transform-origin: 22px calc(100% + 16px);
  pointer-events:none;
  will-change: transform, opacity;
  transition:
    opacity .14s ease,
    transform .20s cubic-bezier(.22,.88,.28,1);
  overflow:visible;
}
.iter-popover-wrap.is-open .iter-level-popover{
  opacity:1;
  transform: translateY(0) scale(1);
  pointer-events:auto;
}
.iter-level-popover-header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  padding:10px 12px;
  border:1px solid rgba(223,229,242,0.92);
  border-bottom:none;
  border-top-left-radius:14px;
  border-top-right-radius:14px;
  background: rgba(255,255,255,0.995);
}
.iter-level-popover-title{
  font-size:13px;
  font-weight:900;
  color:__COLOR_PRIMARIO__;
}
.iter-popover-close{
  border:none;
  background:transparent;
  color:__COLOR_PRIMARIO__;
  font-size:20px;
  font-weight:800;
  line-height:1;
  padding:0 2px;
  cursor:pointer;
}
.iter-level-popover-body{
  border:1px solid rgba(223,229,242,0.92);
  border-bottom-left-radius:14px;
  border-bottom-right-radius:14px;
  background: rgba(255,255,255,0.985);
  box-shadow: 0 16px 30px rgba(6,31,76,0.12);
  padding:12px 12px 14px 12px;
  overflow:visible;
}
.iter-level-option-list{
  display:flex;
  flex-direction:column;
  gap:10px;
  max-height:320px;
  overflow-y:auto;
  overflow-x:hidden;
  padding:4px 4px 8px 4px;
  margin:-4px;
  scrollbar-gutter:stable;
}
.iter-level-option{
  width:100%;
  border:1px solid rgba(223,229,242,0.92);
  border-radius:12px;
  background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,249,255,0.93));
  padding:10px 11px;
  text-align:left;
  cursor:pointer;
  position:relative;
  transition:
    transform .16s ease,
    box-shadow .18s ease,
    border-color .18s ease,
    background .18s ease;
}
.iter-level-option:hover{
  transform: translateY(-1px);
  border-color: rgba(0,36,87,0.22);
  box-shadow: 0 8px 16px rgba(6,31,76,0.09);
}
.iter-level-option.is-active{
  border-color: rgba(0,36,87,0.30);
  background: linear-gradient(180deg, rgba(245,249,255,0.98), rgba(237,244,255,0.95));
  box-shadow: 0 10px 20px rgba(6,31,76,0.10);
}
.iter-level-option-main{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  width:100%;
}
.iter-level-option-label{
  font-size:12.5px;
  font-weight:800;
  color:__COLOR_PRIMARIO__;
  line-height:1.25;
}
.iter-level-option-meta{
  flex:0 0 auto;
  font-size:10.8px;
  font-weight:800;
  color:__COLOR_TEXTO_SUAVE__;
  white-space:nowrap;
}
.iter-level-popover-note{
  margin-top:8px;
  font-size:11px;
  line-height:1.35;
  color:__COLOR_TEXTO_SUAVE__;
}
.rel-table-header{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
}
.rel-table-header-main{
  min-width:0;
}
.rel-table-header-actions{
  flex:0 0 auto;
  display:flex;
  align-items:center;
  justify-content:flex-end;
}
.rel-table-header-actions .shiny-html-output{
  margin:0;
}
.rel-table-header-actions .shiny-download-link{
  margin:0;
}
.rel-download-btn{
  border-radius:10px !important;
  font-size:12px !important;
  font-weight:800 !important;
  padding:6px 10px !important;
  border-color: rgba(0,36,87,0.16) !important;
  background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(242,247,255,0.95)) !important;
}
.rel-download-btn .glyphicon{
  margin-right:4px;
  font-size:12px;
}
.rel-download-btn:hover{
  box-shadow: 0 8px 16px rgba(0,36,87,0.10);
}
.rel-iter-note{
  margin-bottom:10px;
  border:1px solid rgba(223,229,242,0.92);
  border-radius:11px;
  padding:8px 10px;
  background:linear-gradient(180deg, rgba(248,251,255,0.92), rgba(243,247,255,0.90));
  font-size:12px;
  font-weight:700;
  color:__COLOR_TEXTO_SUAVE__;
}
.rel-iter-table-stack{
  display:flex;
  flex-direction:column;
  gap:12px;
}
.rel-iter-table-block{
  border:1px solid rgba(221,228,242,0.94);
  border-radius:14px;
  padding:10px 10px 8px 10px;
  background:linear-gradient(180deg, rgba(255,255,255,0.95), rgba(248,251,255,0.90));
  box-shadow: 0 10px 20px rgba(6,31,76,0.06);
}
.rel-iter-table-head{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:10px;
  margin-bottom:8px;
  padding-bottom:7px;
  border-bottom:1px solid rgba(228,234,245,0.92);
}
.rel-iter-table-title{
  font-size:13px;
  font-weight:900;
  color:__COLOR_PRIMARIO__;
  line-height:1.2;
}
.rel-iter-table-subtitle{
  font-size:11.5px;
  font-weight:700;
  color:__COLOR_TEXTO_SUAVE__;
  white-space:nowrap;
}
.dim-heat-legend{
  margin-top: 10px;
  padding: 8px 10px;
  border:1px solid rgba(224, 231, 243, 0.92);
  border-radius: 12px;
  background: rgba(250, 252, 255, 0.90);
  box-shadow: 0 4px 10px rgba(6,31,76,0.04);
  display:flex;
  align-items:flex-start;
  justify-content:center;
  gap:14px;
  flex-wrap:wrap;
}
.dim-heat-legend-item{
  min-width: 140px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:flex-start;
  gap:5px;
}
.dim-heat-legend-swatch{
  width: 88px;
  height: 9px;
  border-radius: 999px;
  border:1px solid rgba(0,36,87,0.10);
  box-shadow: none;
}
.dim-heat-legend-text{
  font-size:11px;
  font-weight:800;
  color:__COLOR_TEXTO_SUAVE__;
  line-height:1.15;
  text-align:center;
}
.dim-vista-switch-row{
  justify-content:center;
  gap:10px;
  margin-top: 8px;
  margin-bottom: 8px;
}
.dim-vista-switch-row .switch{
  margin: 0 2px;
}
.dim-vista-label{
  min-width: 74px;
  text-align:center;
  color: __COLOR_PRIMARIO__;
  font-weight: 800;
}
.dim-plot-wrap{
  position: relative;
  border:1px solid rgba(221,228,242,0.92);
  border-radius:14px;
  background: linear-gradient(180deg, rgba(255,255,255,0.94), rgba(248,251,255,0.90));
  box-shadow: 0 10px 20px rgba(6,31,76,0.06);
  padding:8px;
}

/* ============================================================
   ====== Plotly ======
   ============================================================ */
.plot-container, .svg-container { width: 100% !important; }
.plotly .main-svg { overflow: visible !important; }
.plotly text{ font-weight:800 !important; }
.plotly .hoverlayer .hovertext{
  font-family: Arial, sans-serif !important;
  border-radius: 10px !important;
}
@keyframes rel-fade-lift {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.rel-plot-stage{
  animation: rel-fade-lift .34s cubic-bezier(.22,.61,.36,1) both;
}
.rel-sm-chip-list{
  display:flex;
  flex-direction:column;
  gap:12px;
}
.rel-sm-chip{
  animation: rel-fade-lift .32s ease both;
}
/* ============================================================
   ====== DataTable ======
   ============================================================ */
table.dataTable { border-collapse: collapse !important; table-layout: fixed !important; width: 100% !important; }
table.dataTable thead th{
  background:linear-gradient(180deg, rgba(241,245,252,0.96), rgba(234,240,250,0.9));
  color:__COLOR_PRIMARIO__;
  font-weight:800;
  border-bottom: 1px solid #d6deef !important;
  border-right: 1px solid #dbe2f1 !important;
  text-align: center !important;
  vertical-align: middle !important;
}
table.dataTable thead tr.dt-filter-row th{
  background:linear-gradient(180deg, rgba(249,252,255,0.98), rgba(243,247,255,0.93)) !important;
  border-bottom: 1px solid #dfe6f3 !important;
  padding-top: 6px !important;
  padding-bottom: 6px !important;
}
table.dataTable tbody td{
  font-size:12px;
  color:__COLOR_TEXTO__;
  border-bottom: 1px solid #edf0f7 !important;
  border-right: 1px solid #edf0f7 !important;
  text-align: center !important;
  vertical-align: middle !important;
  white-space: normal !important;
  word-wrap: break-word !important;
  overflow-wrap: anywhere !important;
}
table.dataTable.rel-table-dt{
  table-layout:auto !important;
  width:max-content !important;
  min-width:100% !important;
}
table.dataTable.rel-table-dt thead th{
  white-space: nowrap !important;
  overflow: visible !important;
  text-overflow: clip !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  min-width: 94px;
}
table.dataTable.rel-table-dt tbody td{
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
}
table.dataTable.rel-table-dt thead th:first-child,
table.dataTable.rel-table-dt tbody td:first-child{
  min-width: 220px;
  white-space: normal !important;
}
table.dataTable tbody tr:hover td{
  background: __COLOR_SUPERFICIE_2__ !important;
}
.dataTables_wrapper .dataTables_scroll{
  border:1px solid rgba(221, 228, 242, 0.94);
  border-radius: 12px;
  overflow: hidden;
}
.rel-iter-table-block .dataTables_wrapper .dataTables_scroll,
.cardbox .dataTables_wrapper .dataTables_scroll{
  overflow-x: auto !important;
}
.dataTables_wrapper .dataTables_scrollHead{
  border-bottom: 1px solid rgba(221, 228, 242, 0.92) !important;
}
table.dataTable thead tr.dt-filter-row .selectize-control.multi .selectize-input{
  border-radius: 9px !important;
  min-height: 30px !important;
  font-size: 11px !important;
  background: rgba(255,255,255,0.95) !important;
}
table.dataTable thead tr.dt-filter-row input[type='text']{
  background: rgba(255,255,255,0.95) !important;
}

/* ============================================================
   ====== Toggle ======
   ============================================================ */
.toggle-row{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-top: 10px;
  margin-bottom: 10px;
}
.toggle-label{
  font-size: 12px;
  color: __COLOR_TEXTO_SUAVE__;
  font-weight: 700;
  white-space: nowrap;
}
.switch {
  position: relative;
  display: inline-block;
  width: 52px;
  height: 28px;
  flex: 0 0 auto;
}
.switch input { display:none; }
.slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: __COLOR_BORDE__;
  transition: .25s;
  border-radius: 999px;
  border: 1px solid #dfe5f2;
}
.slider:before {
  position: absolute;
  content: \"\";
  height: 22px;
  width: 22px;
  left: 3px;
  bottom: 2.5px;
  background-color: white;
  transition: .25s;
  border-radius: 50%;
  box-shadow: 0 6px 14px rgba(0,0,0,0.12);
}
input:checked + .slider {
  background-color: __PRIM_020__;
  border-color: __PRIM_035__;
}
input:checked + .slider:before {
  transform: translateX(23px);
}

/* ============================================================
   ====== Diccionario ======
   ============================================================ */
.dicc-kv{
  display:grid;
  grid-template-columns: 92px 1fr;
  gap: 6px 10px;
  font-size: 12px;
  color: __COLOR_TEXTO__;
}
.dicc-k{
  color: __COLOR_TEXTO_SUAVE__;
  font-weight: 800;
}
.dicc-v{
  color: __COLOR_TEXTO__;
  font-weight: 600;
  word-break: break-word;
}

/* ============================================================
   ====== KPI BLOCK ======
   ============================================================ */
.kpi-block{
  display:flex;
  flex-direction:column;
  gap:10px;
  padding-bottom: 6px;
}

.kpi-block-title{
  font-size:14px;
  font-weight:900;
  color:__COLOR_PRIMARIO__;
  line-height:1.15;
  margin:0;
}

.kpi-block-subtitle{
  margin-top:4px;
  font-size:12px;
  color:__COLOR_TEXTO_SUAVE__;
}

.kpi-n-chip{
  width:100%;
  padding:18px 14px;
  border:1px solid #edf0f7;
  border-radius:16px;
  background:__COLOR_SUPERFICIE_2__;
  display:flex;
  align-items:center;
  justify-content:center;
}

.kpi-n-text{
  font-size:16px;
  font-weight:700;
  color:__COLOR_PRIMARIO__;
  letter-spacing:0.01em;
  line-height: 1.2;
  max-width: 100%;
  white-space: normal;
  word-break: break-word;
  width: 100% !important;
  text-align: center !important;
}

.kpi-grid{
  display:flex;
  gap:12px;
  width:100%;
  align-items:stretch;
}

.kpi-cell{
  flex:1 1 0;
  border:1px solid #edf0f7;
  border-radius:16px;
  padding:8px 8px 10px 8px;
  background:__COLOR_SUPERFICIE__;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  width: 100%;
  box-sizing: border-box;
}

.kpi-legend{
  margin-top:8px !important;
  display:flex;
  flex-wrap:wrap;
  gap:4px 10px;
  justify-content:center !important;
  font-size:10px;
  color:__COLOR_TEXTO_SUAVE__;
  line-height:1.25 !important;
  white-space: normal !important;
  padding: 0 8px 10px 8px !important;
}

.kpi-legend-item{
  display:inline-flex;
  align-items:center;
  gap:6px;
}

.kpi-legend-swatch{
  display:inline-block;
  width:10px;
  height:10px;
  border-radius:3px;
}

.kpi-cell .plotly .gtitle,
.kpi-cell .plotly .g-gtitle,
.kpi-cell .plotly text{
  white-space: normal !important;
}

.kpi-cell .plotly{
  overflow: hidden !important;
}

.kpi-donut-title{
  font-size: 14px;
  font-weight: 900;
  color: __COLOR_PRIMARIO__;
  text-align: center;
  line-height: 1.15;
  margin: 4px 6px 2px 6px;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.kpi-profile-row{
  display:flex;
  gap:12px;
  align-items:stretch;
}

.kpi-n-card{
  flex: 0 0 42%;
  min-width: 320px;
  border:1px solid #edf0f7;
  border-radius:16px;
  background:__COLOR_SUPERFICIE__;
  padding:12px;
  display:flex;
  flex-direction:column;
  justify-content:center;
  align-items: center;
  text-align: center;
  overflow: hidden;
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}

.kpi-n-card .kpi-block-title{
  margin:0 0 8px 0;
}

.kpi-donuts{
  flex: 1 1 auto;
  display:flex;
  gap:12px;
  align-items:stretch;
}

.kpi-donuts .kpi-cell{
  flex:1 1 0;
  min-width: 260px;
}

/* ============================================================
   ====== RESUMEN SECCIÓN ======
   ============================================================ */
.section-summary{
  display:flex;
  flex-direction:column;
  gap:10px;
}

.summary-row{
  border:1px solid #edf0f7;
  border-radius:16px;
  background:__COLOR_SUPERFICIE__;
  padding:10px 12px;
  box-shadow: 0 10px 22px __SHADOW_LOW__;
}

.summary-row-title{
  font-size:13px;
  font-weight:900;
  color:__COLOR_PRIMARIO__;
  line-height:1.2;
  margin:0 0 6px 0;
  overflow-wrap:anywhere;
}

.summary-row-subtitle{
  font-size:11px;
  color:__COLOR_TEXTO_SUAVE__;
  font-weight:700;
  margin:0 0 8px 0;
}

.summary-row-plot{
  height:84px;
  overflow:hidden;
}
.summary-row-plot .table-empty-hint{
  height:100%;
}

.summary-row-plot:has(.sm-card-inner){
  height: auto !important;
  overflow: visible !important;
}

.sm-card-inner{
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: auto !important;
  overflow: visible !important;
}

.sm-option-block{
  height: auto !important;
  overflow: visible !important;
}

/* ============================================================
   Sidebar KPI stack
   ============================================================ */
.kpi-sidebar-stack{
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: stretch;
  width: 100%;
  box-sizing: border-box;
}

.kpi-sidebar-stack .kpi-profile-row{ display:block !important; }
.kpi-sidebar-stack .kpi-donuts{ display:block !important; }

.kpi-sidebar-stack .kpi-n-card{
  flex: 0 0 auto !important;
  min-width: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 12px 12px !important;
  border-radius: 16px !important;
}

.kpi-sidebar-stack .kpi-n-chip{
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
  margin: 0 !important;
  justify-content: center !important;
}

.kpi-sidebar-stack .kpi-n-text{
  width: 100% !important;
  text-align: center !important;
  max-width: 100% !important;
  white-space: normal !important;
  word-break: break-word !important;
  font-weight: 900 !important;
  font-size: 18px !important;
}

.kpi-sidebar-stack .kpi-cell{
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
  margin: 0 !important;
  overflow: hidden !important;
  height: auto !important;
  min-height: 340px !important;
  padding-bottom: 14px !important;
}

.kpi-sidebar-stack .plotly.html-widget,
.kpi-sidebar-stack .plot-container,
.kpi-sidebar-stack .svg-container{
  width: 100% !important;
  max-width: 100% !important;
}

#kpi_plot_1, #kpi_plot_2{
  height: 220px !important;
  min-height: 220px !important;
}

#kpi_plot_1 .plot-container,
#kpi_plot_2 .plot-container,
#kpi_plot_1 .svg-container,
#kpi_plot_2 .svg-container{
  height: 220px !important;
  min-height: 220px !important;
}

.sidebarPanel .cardbox{
  overflow: hidden !important;
}

/* ============================================================
   NAVBAR COMO TOGGLE
   ============================================================ */
.navbar{
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  margin-bottom: 14px !important;
  min-height: auto !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
}

.navbar > .container-fluid{
  padding-left: 15px !important;
  padding-right: 15px !important;
}

.navbar .nav{
  margin-left: 0 !important;
  border-bottom: 0 !important;
  box-shadow: none !important;
  padding-bottom: 6px;
}

.navbar .nav.navbar-nav{
  position: relative;
  display: inline-flex !important;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(236,242,252,0.90), rgba(228,236,248,0.86));
  border: 1px solid rgba(212,221,238,0.95);
  box-shadow: 0 10px 22px rgba(6,31,76,0.09), inset 0 1px 0 rgba(255,255,255,0.72);
  margin: 0 !important;
  padding-left: 10px;
}

.navbar .nav.navbar-nav::before{
  content: \"\";
  position: absolute;
  top: 3px;
  left: 3px;
  height: calc(100% - 6px);
  width: var(--pill-w, 0px);
  transform: translateX(var(--pill-x, 0px));
  border-radius: 999px;
  background: __COLOR_SUPERFICIE__;
  border: 1px solid __PILL_BORDER__;
  box-shadow: 0 10px 24px rgba(0,0,0,0.10);
  transition: transform 220ms cubic-bezier(.2,.9,.2,1),
              width 220ms cubic-bezier(.2,.9,.2,1);
  z-index: 0;
}

.navbar .nav > li{
  position: relative;
  z-index: 1;
}

.navbar .nav > li > a{
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  color: __COLOR_PRIMARIO__ !important;
  font-weight: 900 !important;
  font-size: 13px;
  padding: 8px 14px !important;
  border-radius: 999px;
  line-height: 1;
  border-bottom: 0 !important;
}

.navbar .nav > li > a:hover{
  background: __PRIM_006__ !important;
}

.navbar .nav > li.active > a,
.navbar .nav > li.active > a:hover,
.navbar .nav > li.active > a:focus{
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  outline: none !important;
  color: __COLOR_PRIMARIO__ !important;
}

.col-sm-3, .col-sm-9{
  padding-left: 10px;
  padding-right: 10px;
}

@media (max-width: 991px){
  .topbar{
    padding: 14px 14px;
    border-radius: 16px;
  }
  .topbar-title{
    font-size: 22px;
  }
  .sidebar-stack{
    gap: 10px;
  }
  .cardbox-data{
    min-height: 680px;
  }
  .dt-toolbar{
    flex-wrap: wrap;
    row-gap: 8px;
  }
  .dt-toolbar-left{
    gap: 8px;
  }
  .dt-toolbar-right{
    width: 100%;
    margin-left: 0;
  }
  .dt-toolbar-right .dataTables_filter{
    width: 100%;
  }
  .dt-toolbar-right .dataTables_filter input{
    width: calc(100% - 62px) !important;
    max-width: 100%;
  }
  .dictionary-popover{
    top:58px;
    left:8px;
    width: calc(100% - 16px);
  }
  .rel-plot-header,
  .rel-table-header{
    flex-wrap:wrap;
  }
  .rel-plot-header-actions,
  .rel-table-header-actions{
    width:100%;
    justify-content:flex-start;
  }
  .rel-iter-level-chip{
    max-width:100%;
  }
  .iter-level-popover{
    left:0;
    right:auto;
    width: min(320px, calc(100vw - 42px));
  }
}
"

repl <- c(
  "__COLOR_PRIMARIO__"      = color_primario,
  "__COLOR_FONDO_APP__"     = color_fondo_app,
  "__COLOR_BORDE__"         = color_borde,
  "__COLOR_TEXTO__"         = color_texto,
  "__COLOR_TEXTO_SUAVE__"   = color_texto_suave,
  "__COLOR_SUPERFICIE__"    = color_superficie,
  "__COLOR_SUPERFICIE_2__"  = color_superficie_2,
  "__COLOR_HEADER_TABLA__"  = color_header_tabla,
  "__SHADOW_SOFT__"         = shadow_soft,
  "__SHADOW_MED__"          = shadow_med,
  "__SHADOW_LOW__"          = shadow_low,
  "__FOCUS_RING__"          = focus_ring,
  "__PRIM_005__"            = prim_005,
  "__PRIM_006__"            = prim_006,
  "__PRIM_020__"            = prim_020,
  "__PRIM_035__"            = prim_035,
  "__PRIM_085__"            = prim_085,
  "__PILL_BORDER__"         = pill_border
)

for (pat in names(repl)) {
  css <- gsub(pat, repl[[pat]], css, fixed = TRUE)
}

shiny::tags$style(shiny::HTML(css))
}

# -----------------------------------------------------------------------------
# JS de la app
# -----------------------------------------------------------------------------

reporte_interactivo_theme_js <- function() {
  shiny::tags$script(shiny::HTML("
(function(){
  function getNav(){
    return document.querySelector('.navbar .nav.navbar-nav') ||
           document.querySelector('.navbar .nav');
  }

  function closeIterPopovers(exceptWrap){
    var wraps = document.querySelectorAll('.iter-popover-wrap.is-open');
    wraps.forEach(function(wrap){
      if(exceptWrap && wrap === exceptWrap) return;
      wrap.classList.remove('is-open');
      var btn = wrap.querySelector('.iter-popover-toggle');
      if(btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  function openIterPopover(wrap){
    if(!wrap) return;
    closeIterPopovers(wrap);
    wrap.classList.add('is-open');
    var btn = wrap.querySelector('.iter-popover-toggle');
    if(btn) btn.setAttribute('aria-expanded', 'true');

    setTimeout(function(){
      var input = wrap.querySelector('.selectize-control input');
      if(input) input.focus();
    }, 0);
  }

  function getActiveLink(nav){
    if(!nav) return null;
    return nav.querySelector('li.active > a') ||
           nav.querySelector('li.active a') ||
           nav.querySelector('a[aria-selected=\"true\"]');
  }

  function updatePill(){
    var nav = getNav();
    if(!nav) return;
    var active = getActiveLink(nav);
    if(!active) return;

    var navRect = nav.getBoundingClientRect();
    var aRect   = active.getBoundingClientRect();

    var x = (aRect.left - navRect.left);
    var w = aRect.width;

    nav.style.setProperty('--pill-x', x + 'px');
    nav.style.setProperty('--pill-w', w + 'px');
  }

  function bindNavClicks(){
    document.addEventListener('click', function(e){
      var a = e.target && (e.target.closest ? e.target.closest('.navbar a') : null);
      if(!a) return;

      setTimeout(updatePill, 0);
      setTimeout(updatePill, 50);
      setTimeout(updatePill, 120);
    }, true);
  }

  function bindIterPopoverClicks(){
    document.addEventListener('click', function(e){
      var toggle = e.target && (e.target.closest ? e.target.closest('.iter-popover-toggle') : null);
      if(toggle){
        e.preventDefault();
        e.stopPropagation();
        var wrapToggle = toggle.closest('.iter-popover-wrap');
        if(wrapToggle && wrapToggle.classList.contains('is-open')){
          closeIterPopovers();
        } else {
          openIterPopover(wrapToggle);
        }
        return;
      }

      var levelOption = e.target && (e.target.closest ? e.target.closest('.iter-level-option') : null);
      if(levelOption){
        e.preventDefault();
        e.stopPropagation();

        var inputId = levelOption.getAttribute('data-target-input');
        var value = levelOption.getAttribute('data-value');
        if(window.Shiny && inputId){
          window.Shiny.setInputValue(inputId, value, {priority: 'event'});
        }

        var wrapOption = levelOption.closest('.iter-popover-wrap');
        if(wrapOption){
          var activeItems = wrapOption.querySelectorAll('.iter-level-option.is-active');
          activeItems.forEach(function(node){
            node.classList.remove('is-active');
          });
          levelOption.classList.add('is-active');
        }

        closeIterPopovers();
        return;
      }

      var closeBtn = e.target && (e.target.closest ? e.target.closest('.iter-popover-close') : null);
      if(closeBtn){
        e.preventDefault();
        closeIterPopovers();
        return;
      }

      var disabledDownload = e.target && (e.target.closest ? e.target.closest('a.shiny-download-link[aria-disabled=\"true\"]') : null);
      if(disabledDownload){
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if(e.target && e.target.closest && e.target.closest('.iter-level-popover')){
        return;
      }

      closeIterPopovers();
    }, true);
  }

  function bindIterPopoverChanges(){
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape'){
        closeIterPopovers();
      }
    }, true);
  }

  function registerCustomHandlers(){
    if(!window.Shiny || !window.Shiny.addCustomMessageHandler || window.__interactiveThemeHandlersBound){
      return;
    }

    window.Shiny.addCustomMessageHandler('toggleDownloadDisabled', function(payload){
      if(!payload || !payload.id) return;
      var el = document.getElementById(payload.id);
      if(!el) return;

      var disabled = !!payload.disabled;
      if(disabled){
        el.classList.add('is-disabled');
        el.setAttribute('aria-disabled', 'true');
        el.setAttribute('tabindex', '-1');
      } else {
        el.classList.remove('is-disabled');
        el.setAttribute('aria-disabled', 'false');
        el.removeAttribute('tabindex');
      }
    });

    window.__interactiveThemeHandlersBound = true;
  }

  function observeActiveChanges(){
    var nav = getNav();
    if(!nav || !window.MutationObserver) return;

    var obs = new MutationObserver(function(muts){
      var should = muts.some(function(m){
        return m.type === 'attributes' || m.type === 'childList';
      });
      if(should){
        window.requestAnimationFrame(updatePill);
      }
    });

    obs.observe(nav, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class','style','aria-selected']
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(updatePill, 80);
    setTimeout(updatePill, 200);
    bindNavClicks();
    bindIterPopoverClicks();
    bindIterPopoverChanges();
    observeActiveChanges();
    registerCustomHandlers();
  });

  document.addEventListener('shown.bs.tab', function(){
    setTimeout(updatePill, 0);
    closeIterPopovers();
  });

  if(window.Shiny){
    document.addEventListener('shiny:value', function(){
      setTimeout(updatePill, 0);
      setTimeout(updatePill, 80);
    });

    document.addEventListener('shiny:connected', function(){
      setTimeout(updatePill, 120);
      registerCustomHandlers();
    });
  }

  window.addEventListener('resize', function(){
    updatePill();
  });
})();
"))
}
