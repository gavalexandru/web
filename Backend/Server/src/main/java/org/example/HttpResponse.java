package org.example;

public class HttpResponse {
    private final int statusCode;
    private final String statusMessage;
    private final String contentType;
    private final String content;
    private final String session;
    private final String jwt;
    public HttpResponse(int statusCode, String statusMessage, String contentType, String content, String session, String jwt) {
        this.statusCode = statusCode;
        this.statusMessage = statusMessage;
        this.contentType = contentType;
        this.content = content;
        this.session = session;
        this.jwt = jwt;
    }

    public String getHeaders() {
        System.out.println("jwt: " + jwt);
        if(session == "/login" && jwt != null){
            return "HTTP/1.1 " + statusCode + " " + statusMessage + "\r\n" +
                    "Content-Type: " + contentType + "\r\n" +
                    "Content-Length: " + content.length() + "\r\n" +
                    "Set-Cookie: jwt=" + jwt + "; HttpOnly; Path=/; Max-Age=900\r\n" +
                    "Cache-Control: no-cache, no-store, must-revalidate\r\n" +
                    "Pragma: no-cache\r\n" +
                    "Expires: 0\r\n" +
                    "X-Content-Type-Options: nosniff\r\n" +
                    "X-Frame-Options: DENY\r\n" +
                    "X-XSS-Protection: 1; mode=block\r\n" +
                    "Access-Control-Allow-Origin: http://localhost\r\n" +
                    "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n" +
                    "Access-Control-Allow-Headers: Content-Type\r\n" +
                    "Access-Control-Allow-Credentials: true\r\n" +
                    "Connection: close\r\n" +
                    "\r\n";
        }
        else {
            return "HTTP/1.1 " + statusCode + " " + statusMessage + "\r\n" +
                    "Content-Type: " + contentType + "\r\n" +
                    "Content-Length: " + content.length() + "\r\n" +
                    "Access-Control-Allow-Origin: http://localhost\r\n" +
                    "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n" +
                    "Access-Control-Allow-Headers: Content-Type\r\n" +
                    "Access-Control-Allow-Credentials: true\r\n" +
                    "Connection: close\r\n" +
                    "\r\n";
        }
    }

    public String getContent() {
        return content;
    }
}
