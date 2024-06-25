import http.server
import socketserver

PORT = 8080  # Define the port number (optional)

class Handler(http.server.SimpleHTTPRequestHandler):
    pass

httpd = socketserver.TCPServer(("", PORT), Handler)  # Use defined port if available

print("Serving at port", PORT)  # Print the port number (optional)
httpd.serve_forever()
