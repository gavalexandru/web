package org.example;

import java.util.List;

public class HttpRequest {
    private final String requestLine;
    private final List<String> headers;
    private final String body;
    private final String accessToken;
    private final String refreshToken;

    public HttpRequest(String requestLine, List<String> headers, String body, String accessToken, String refreshToken) {
        this.requestLine = requestLine;
        this.headers = headers;
        this.body = body;
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
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
    public String getAccessToken() {
        return accessToken;
    }
    public String getRefreshToken() {
        return refreshToken;
    }
}
