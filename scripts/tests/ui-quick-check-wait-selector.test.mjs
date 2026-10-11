import assert from "node:assert/strict";
import test from "node:test";

import { desvioDeRuta, summarize } from "../ui-quick-check.mjs";

// Una captura limpia: sin hallazgos y con ambas esperas cumplidas.
function captura(extra = {}) {
  return {
    route: "/graficos?pestana=laminas",
    viewport: { width: 1440, height: 1000 },
    screenshot: "x.png",
    waitSelectorMatched: true,
    postClickWaitSelectorMatched: true,
    ...extra,
  };
}

test("una captura que nunca casa el --post-click-wait-selector no aprueba", () => {
  const limpia = summarize([captura()], { api: "real" });
  assert.equal(limpia.ok, true);
  assert.equal(limpia.postClickWaitSelectorMisses, 0);

  // El caso real: `/procesamiento?seccion=graficos` aterrizó en Validación ›
  // Explorar, el panel nunca apareció en ninguna captura y el gate dio verde.
  const resumen = summarize([
    captura({ postClickWaitSelectorMatched: false, readinessMarca: "validacion-explorar" }),
    captura({ postClickWaitSelectorMatched: false, readinessMarca: "validacion-explorar" }),
  ], { api: "real" });
  assert.equal(resumen.ok, false);
  assert.equal(resumen.postClickWaitSelectorMisses, 2);
  assert.equal(resumen.waitSelectorMisses, 0, "la espera de carga sí casó: cada contador dice la suya");
});

test("el --wait-selector de carga sigue contando aparte", () => {
  const resumen = summarize([captura({ waitSelectorMatched: false })], { api: "real" });
  assert.equal(resumen.ok, false);
  assert.equal(resumen.waitSelectorMisses, 1);
  assert.equal(resumen.postClickWaitSelectorMisses, 0);
});

test("la ruta desviada se cuenta y se detalla, pero no falla por sí sola", () => {
  const motivo = desvioDeRuta(
    "/procesamiento?seccion=graficos&pestana=laminas&panel=guias",
    "http://localhost:5173/validacion?pestana=explorar",
  );
  assert.match(motivo, /\/procesamiento → \/validacion/);
  assert.match(motivo, /redirige a la fase accionable/);

  const resumen = summarize([
    captura({ routeDeviation: motivo, finalUrl: "http://localhost:5173/validacion", readinessMarca: "validacion-explorar" }),
  ], { api: "real" });
  assert.equal(resumen.routeDeviations, 1);
  assert.equal(resumen.routeDeviationDetalle[0].readiness, "validacion-explorar");
  assert.equal(resumen.ok, true);
});

test("desvioDeRuta tolera la sección implícita y señala un nivel reescrito", () => {
  // `/graficos` no escribe `seccion=`: faltar no es desviarse.
  assert.equal(
    desvioDeRuta("/graficos?seccion=graficos&pestana=laminas", "http://localhost:5173/graficos?pestana=laminas&devPulso=x"),
    null,
  );
  assert.equal(desvioDeRuta("/carga/", "http://localhost:5173/carga"), null);
  assert.match(
    desvioDeRuta("/graficos?pestana=laminas", "http://localhost:5173/graficos?pestana=graficadores"),
    /pestana=laminas terminó como pestana=graficadores/,
  );
});
