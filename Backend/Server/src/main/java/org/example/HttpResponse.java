package org.example;

public class HttpResponse {
    private final int statusCode;
    private final String statusMessage;
    private final String contentType;
    private final String content;
    private final String session;
    private final String accessToken;
    private final String refreshToken;
    public HttpResponse(int statusCode, String statusMessage, String contentType, String content, String session, String accessToken, String refreshToken) {
        this.statusCode = statusCode;
        this.statusMessage = statusMessage;
        this.contentType = contentType;
        this.content = content;
        this.session = session;
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
    }

    public String getHeaders() {
        if(session == "/logout"){
            return "HTTP/1.1 " + statusCode + " " + statusMessage + "\r\n" +
                    "Content-Type: " + contentType + "\r\n" +
                    "Content-Length: " + content.length() + "\r\n" +
                    "Set-Cookie: access_token=" + "; HttpOnly; Path=/; Max-Age=0\r\n" +
                    "Set-Cookie: refresh_token=" + "; HttpOnly; Path=/; Max-Age=0\r\n" +
                    "Cache-Control: no-cache, no-store, must-revalidate\r\n" +
                    "Pragma: no-cache\r\n" +
                    "Expires: Thu, 01 Jan 1970 00:00:00 GMT\r\n" + // for deleting cookie
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
        else if(accessToken != null && refreshToken != null){
            return "HTTP/1.1 " + statusCode + " " + statusMessage + "\r\n" +
                    "Content-Type: " + contentType + "\r\n" +
                    "Content-Length: " + content.length() + "\r\n" +
                    "Set-Cookie: access_token=" + accessToken + "; HttpOnly; Path=/; Max-Age=900\r\n" + //15 minutes
                    "Set-Cookie: refresh_token=" + refreshToken + "; HttpOnly; Path=/; Max-Age=604800\r\n" + // 7 days
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
        else if(refreshToken != null && accessToken == null){
            return "HTTP/1.1 " + statusCode + " " + statusMessage + "\r\n" +
                    "Content-Type: " + contentType + "\r\n" +
                    "Content-Length: " + content.length() + "\r\n" +
                    "Set-Cookie: access_token=" + accessToken + "; HttpOnly; Path=/; Max-Age=900\r\n" + //15 minutes
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