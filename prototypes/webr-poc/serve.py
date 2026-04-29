#!/usr/bin/env python3
"""
Servidor HTTP local para el PoC de WebR.

WebR necesita SharedArrayBuffer, que el browser solo expone si la página
viene con headers COOP + COEP que la marquen como "cross-origin isolated".
`python3 -m http.server` no los manda — por eso este wrapper.

Uso:
    cd prototypes/webr-poc
    python3 serve.py
    # → abre http://localhost:8765
"""
import http.server
import socketserver
import sys
import webbrowser
from functools import partial

PORT = 8765


class COOPCOEPHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        # Permite que el iframe (si se usa dentro de algo) cargue.
        self.send_header("Cross-Origin-Resource-Policy", "cross-origin")
        # Cache off para desarrollo.
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Log compacto: status + path.
        sys.stdout.write(f"[{self.log_date_time_string()}] {fmt % args}\n")


def main() -> None:
    handler = partial(COOPCOEPHandler, directory=".")
    with socketserver.TCPServer(("127.0.0.1", PORT), handler) as httpd:
        url = f"http://localhost:{PORT}"
        print(f"WebR PoC corriendo en {url}")
        print("Headers COOP/COEP activos — WebR debería funcionar.")
        print("Ctrl+C para parar.\n")
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutdown.")


if __name__ == "__main__":
    main()
