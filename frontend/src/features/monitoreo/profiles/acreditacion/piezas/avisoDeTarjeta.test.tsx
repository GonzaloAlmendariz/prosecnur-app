import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AvisoDeTarjeta, AvisosDeTarjeta, PestanaSinContenido, VacioDeBloque } from "./AvisoDeTarjeta";
import { ladoDelDesborde } from "./MarcoDesplazable";
import { MarcaDeLectura } from "../navegacion/MarcaDeLectura";
import { RotuloDePestanaContexto } from "../navegacion/rotuloDePestana";

describe("avisos, trabas y vacíos del perfil", () => {
  it("la pestaña sin contenido es una tarjeta con su rótulo y el motivo dentro (C3)", () => {
    const html = renderToStaticMarkup(
      <RotuloDePestanaContexto.Provider value={{ antetitulo: "Control · Casos · Respuestas", chips: [] }}>
        <PestanaSinContenido titulo="Respuestas recibidas" icono={null} motivo="El corte todavía no trae respuestas." descripcion="Llegan al actualizar." />
      </RotuloDePestanaContexto.Provider>,
    );
    expect(html).toContain("acr-av-panel");
    expect(html).toContain("Control · Casos · Respuestas");
    expect(html).toContain("pulso-estado-vacio");
    expect(html).toContain('data-vacio="legitimo"');
  });

  it("cargando se marca ocupado y el error usa el aviso del sistema", () => {
    const cargando = renderToStaticMarkup(<PestanaSinContenido vacio="cargando" titulo="Cuotas" icono={null} motivo="Leyendo las cuotas del estudio." />);
    expect(cargando).toContain('aria-busy="true"');
    const error = renderToStaticMarkup(<PestanaSinContenido vacio="error" titulo="Cuotas" icono={null} motivo="No se pudo leer." />);
    expect(error).toContain("pulso-alert-error");
  });

  it("avisos y vacíos de bloque llevan el mismo aire y su clase de vacío", () => {
    expect(renderToStaticMarkup(<AvisoDeTarjeta kind="warn">Falta algo.</AvisoDeTarjeta>)).toContain("acr-aviso");
    expect(renderToStaticMarkup(<AvisosDeTarjeta avisos={[]} />)).toBe("");
    expect(renderToStaticMarkup(<VacioDeBloque vacio="sin-coincidencias" icono={null} titulo="Nadie coincide." />)).toContain('data-vacio="sin-coincidencias"');
  });

  it("la marca de lectura publica false sólo mientras lee", () => {
    expect(renderToStaticMarkup(<MarcaDeLectura leyendo />)).toContain('data-audit-ready="false"');
    expect(renderToStaticMarkup(<MarcaDeLectura leyendo={false} />)).toContain('data-audit-ready="true"');
  });

  it("el marco desplazable señala el borde que esconde columnas", () => {
    expect(ladoDelDesborde(0, 900, 900)).toBeNull();
    expect(ladoDelDesborde(0, 1044, 900)).toBe("derecha");
    expect(ladoDelDesborde(60, 1044, 900)).toBe("ambos");
    expect(ladoDelDesborde(144, 1044, 900)).toBe("izquierda");
  });
});
