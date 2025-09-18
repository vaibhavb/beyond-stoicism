#!/usr/bin/env python3
"""
Simple SPA development server with HTML5 history fallback.

Usage:
  python3 spa_server.py [port]

Serves static files from the current directory. If a requested path does not
exist on disk, it falls back to serving index.html, so deep links like
  /cyrenaicism or /stoicism
resolve to the app shell without 404 errors.
"""
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class SPARequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Try to serve the file normally
        requested_path = self.translate_path(self.path)

        if os.path.isdir(requested_path):
            # Serve index.html for directory roots
            for index in ("index.html", "index.htm"):
                index_path = os.path.join(requested_path, index)
                if os.path.exists(index_path):
                    return http.server.SimpleHTTPRequestHandler.do_GET(self)

        if os.path.exists(requested_path):
            return http.server.SimpleHTTPRequestHandler.do_GET(self)

        # Fallback: serve SPA shell
        self.path = "/index.html"
        return http.server.SimpleHTTPRequestHandler.do_GET(self)


if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), SPARequestHandler) as httpd:
        print(f"Serving Beyond Stoicism at http://localhost:{PORT}")
        print("Deep links like /cyrenaicism will load index.html via fallback.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down...")
