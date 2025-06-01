package org.example;

import java.util.List;

public class HttpRequest {
    private final String requestLine;
    private final List<String> headers;
    private final String body;

    public HttpRequest(String requestLine, List<String> headers, String body) {
        this.requestLine = requestLine;
        this.headers = headers;
        this.body = body;
    }

    public String getRequestLine() {
        return requestLine;
    }

    public List<String> getHeaders() {
        return headers;
    }

    public String getBody() {
        return body;
    }
}