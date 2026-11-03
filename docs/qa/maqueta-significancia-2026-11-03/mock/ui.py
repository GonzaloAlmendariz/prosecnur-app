# Piezas HTML de la UI de Prosecnur (Procesamiento › Gráficos) con los tokens reales de tokens.css.
CSS = r"""
:root{--pulso-brand-navy:#002457;--pulso-bg:#f3f5f9;--pulso-bg-deep:#e9edf5;--pulso-surface:#fff;--pulso-border:#e2e7f0;
--pulso-border-strong:#cbd5e4;--pulso-text:#17212f;--pulso-text-soft:#474f5b;--pulso-text-faint:#657082;
--mod:#0f766e;--mod-soft:rgba(15,118,110,.13);--mod-border:rgba(15,118,110,.3);
--warn-bg:#fff4e0;--warn-border:#f0d799;--warn-fg:#8a5000;--warn-accent:#d97706;
--danger-bg:#fef2f2;--danger-border:#fecaca;--danger-fg:#991b1b;--ok-bg:#dcfce7;--ok-fg:#166534;
--lam-azul:#081F5C;--lam-banda:#E3E7EF;--lam-medio:#4F7FAF;--r:10px;--rc:14px}
*{box-sizing:border-box}body{margin:0;font:13px/1.4 -apple-system,"SF Pro Text",system-ui,sans-serif;color:var(--pulso-text);background:var(--pulso-bg)}
.app{display:grid;grid-template-rows:52px 46px 1fr;height:100vh}
.top{display:flex;align-items:center;gap:14px;padding:0 18px;background:var(--pulso-surface);border-bottom:1px solid var(--pulso-border)}
.brand{font-weight:700;font-size:16px;color:var(--pulso-brand-navy)}.pill{border-radius:999px;padding:4px 12px;font-weight:600}
.secs{margin:0 auto;display:flex;gap:4px;background:var(--pulso-bg);border:1px solid var(--pulso-border);border-radius:999px;padding:3px}
.secs span{padding:5px 12px;border-radius:999px;font-weight:600;color:var(--mod)}.secs .on{background:var(--mod);color:#fff}
.bar{display:flex;align-items:center;gap:10px;padding:0 16px;background:var(--pulso-surface);border-bottom:1px solid var(--pulso-border)}
.btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--pulso-border-strong);background:#fff;border-radius:8px;padding:5px 10px;font-weight:550;font-size:12.5px;color:var(--pulso-text)}
.btn.acc{background:var(--mod);color:#fff;border-color:var(--mod)}.btn.soft{background:var(--mod-soft);border-color:var(--mod-border);color:var(--mod)}
.btn.ghost{border-color:transparent;background:transparent;color:var(--mod)}
.main{display:grid;grid-template-columns:1fr 400px;min-height:0}
.canvas{padding:22px;overflow:hidden;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:flex-start}
.slide{background:#fff;border-radius:6px;box-shadow:0 4px 18px rgba(16,24,40,.10);overflow:hidden;position:relative}
.insp{background:var(--pulso-surface);border-left:1px solid var(--pulso-border);display:flex;flex-direction:column;min-height:0}
.insp-h{padding:12px 16px;border-bottom:1px solid var(--pulso-border);display:flex;align-items:center;gap:10px}
.insp-h b{font-size:15px}.insp-b{padding:14px 16px;overflow:hidden;display:flex;flex-direction:column;gap:14px}
.tabs{display:grid;grid-template-columns:1fr 1fr;margin:10px 16px 0;background:var(--pulso-bg);border-radius:9px;padding:3px}
.tabs span{text-align:center;padding:6px;border-radius:7px;font-weight:600;color:var(--pulso-text-soft)}.tabs .on{background:var(--mod);color:#fff}
.sec-t{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--pulso-text-faint);font-weight:700}
.card{border:1px solid var(--pulso-border);border-radius:var(--rc);padding:12px 14px;background:#fff}
.row{display:flex;align-items:center;gap:10px}.sp{flex:1}
.sw{width:34px;height:20px;border-radius:999px;background:var(--mod);position:relative;flex:none}.sw:after{content:"";position:absolute;right:2px;top:2px;width:16px;height:16px;border-radius:50%;background:#fff}
.sw.off{background:var(--pulso-border-strong)}.sw.off:after{right:auto;left:2px}
.seg{display:inline-flex;background:var(--pulso-bg);border:1px solid var(--pulso-border);border-radius:8px;padding:2px}
.seg span{padding:4px 10px;border-radius:6px;font-weight:600;font-size:12px;color:var(--pulso-text-soft)}.seg .on{background:#fff;color:var(--mod);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.help{color:var(--pulso-text-faint);font-size:12px}
.stat{display:flex;gap:8px;flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:600;border:1px solid var(--pulso-border);background:#fff}
.chip.m{background:var(--lam-banda);border-color:transparent;color:var(--lam-azul)}
.chip.f{border:1.3px dashed var(--lam-medio);color:var(--lam-medio)}
.chip.u{color:var(--pulso-text-faint)}.chip.w{background:var(--warn-bg);border-color:var(--warn-border);color:var(--warn-fg)}
.chip.e{background:var(--danger-bg);border-color:var(--danger-border);color:var(--danger-fg)}
.tri{width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:9px solid var(--lam-azul);display:inline-block}
.tri.o{border-bottom-color:var(--lam-medio)}
.kv{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:12.5px}.kv dt{color:var(--pulso-text-faint)}.kv dd{margin:0;font-weight:600}
table{border-collapse:collapse;width:100%;font-size:12.5px}th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--pulso-text-faint);text-align:left;padding:8px;border-bottom:1px solid var(--pulso-border)}
td{padding:8px;border-bottom:1px solid var(--pulso-border);vertical-align:middle}tr.sel td{background:var(--mod-soft)}
.pop{position:absolute;background:#fff;border:1px solid var(--pulso-border-strong);border-radius:12px;box-shadow:0 12px 32px rgba(16,24,40,.18);padding:14px 16px;width:330px;font-size:12.5px}
.note{background:var(--pulso-bg);border-radius:10px;padding:10px 12px;font-size:12px;color:var(--pulso-text-soft)}
.sel-box{border:1px solid var(--pulso-border-strong);border-radius:8px;padding:6px 10px;display:flex;justify-content:space-between;background:#fff}
.radio{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid var(--pulso-border);border-radius:10px}
.radio.on{border-color:var(--mod);background:var(--mod-soft)}.dot{width:16px;height:16px;border-radius:50%;border:2px solid var(--pulso-border-strong);flex:none;margin-top:1px}
.radio.on .dot{border:5px solid var(--mod)}
.rec{font-size:10.5px;font-weight:700;color:var(--mod);background:var(--mod-soft);border-radius:999px;padding:1px 8px;margin-left:6px}
.skel{background:linear-gradient(90deg,#eef1f6,#f7f9fc,#eef1f6);border-radius:6px;height:12px}
"""


def shell(canvas, insp, titulo_barra="Lámina 40 de 95", extra=""):
    return f"""<html><head><style>{CSS}</style></head><body><div class="app">
<div class="top"><span class="brand">▮ Prosecnur</span><span class="pill" style="background:var(--mod);color:#fff">Procesamiento</span>
<div class="secs"><span>Carga</span><span>Validación</span><span>Codificación</span><span>Analítica</span><span class="on">Gráficos</span></div>
<span class="chip">ccss · guardado</span></div>
<div class="bar"><b>Perfil del estudiante de la Facultad de Ciencias Sociales</b><span class="help">95 láminas</span><span class="sp"></span>
<span class="btn">‹</span><span class="btn">›</span><span class="btn">{titulo_barra}</span><span class="btn soft">◉ Previsualizar</span>{extra}<span class="btn">⇩ Exportar</span></div>
<div class="main"><div class="canvas">{canvas}</div><div class="insp">{insp}</div></div></div></body></html>"""
