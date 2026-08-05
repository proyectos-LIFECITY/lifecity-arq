#!/usr/bin/env python3
"""Servidor estatico local para LifeCity ARQ (plataforma MEP 2D).
Fuerza el MIME de .js/.mjs a text/javascript para que los modulos ES carguen
bien en Windows (donde el registro a veces los marca como text/plain)."""
import http.server
import socketserver

PORT = 8130
Handler = http.server.SimpleHTTPRequestHandler
Handler.extensions_map = dict(Handler.extensions_map)
Handler.extensions_map.update({
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
})

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
        print(f"LifeCity ARQ en http://localhost:{PORT}  (Ctrl+C para detener)")
        httpd.serve_forever()
