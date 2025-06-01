package org.example;

public class HttpResponse {
    private final int statusCode;
    private final String statusMessage;
    private final String contentType;
    private final String content;

    public HttpResponse(int statusCode, String statusMessage, String contentType, String content) {
        this.statusCode = statusCode;
        this.statusMessage = statusMessage;
        this.contentType = contentType;
        this.content = content;
    }

    public String getHeaders() {
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

    public String getContent() {
        return content;
    }
}