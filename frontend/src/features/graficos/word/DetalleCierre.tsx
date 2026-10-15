// Word, Cierre (W7 del rediseño, 2026-10-15): el contacto de la contraportada. Escribe `documento_word.contacto`
// (correo, dirección, web), que el motor ya lee; un campo vacío usa el dato de PULSO PUCP. El logo viene de Identidad.

import { useLocation, useNavigate } from "react-router-dom";
import { conNivel } from "../../../lib/navegacion/direccion";
import { searchConNivel } from "../../../lib/navegacion/useDireccion";
import { usePlanStore } from "../store";
import { CampoTexto } from "./DetalleDocumento";
import { CONTACTO_RECETARIO, type ClaveContacto } from "./modeloCierreWord";

const CAMPOS: readonly { clave: ClaveContacto; etiqueta: string; max: number }[] = [
  { clave: "correo", etiqueta: "Correo", max: 120 },
  { clave: "web", etiqueta: "Web", max: 120 },
  { clave: "direccion", etiqueta: "Dirección", max: 200 },
];

export function DetalleCierre() {
  const dw = usePlanStore((s) => s.documentoWord);
  const setDw = usePlanStore((s) => s.setDocumentoWord);
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const ir = (pestana: string, foco: string) => navigate({ pathname, search: conNivel(searchConNivel(search, "pestana", pestana), "foco", foco) });
  const contacto = dw.contacto ?? {};
  return (
    <section className="pulso-f6-informe-seccion" aria-label="Contraportada" data-qa-geometry-member data-seccion="word-cierre">
      <h3 className="pulso-f6-w-titulo">Contraportada</h3>
      <p className="pulso-f6-informe-ayuda">El logo al centro y, debajo, una línea de contacto. Un campo vacío usa el dato de PULSO PUCP.</p>
      <div className="pulso-f6-w-campos">
        {CAMPOS.map((c) => (
          <CampoTexto key={c.clave} etiqueta={c.etiqueta} valor={contacto[c.clave] ?? ""} placeholder={CONTACTO_RECETARIO[c.clave]} max={c.max}
            ayuda={contacto[c.clave] ? "Propio de este informe." : "Vacío, el de PULSO PUCP."}
            onGuardar={(v) => setDw({ ...dw, contacto: { ...contacto, [c.clave]: v } })} />
        ))}
      </div>
      <p className="pulso-f6-informe-ayuda">
        El logo se elige en <button type="button" className="pulso-f6-w-vinculo" onClick={() => ir("identidad", "logos")}>Identidad</button>.
        Las respuestas abiertas de tipo Otros se deciden en <button type="button" className="pulso-f6-w-vinculo" onClick={() => ir("reglas", "otros")}>Reglas</button>.
      </p>
    </section>
  );
}
