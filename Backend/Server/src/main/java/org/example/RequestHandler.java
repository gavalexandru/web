package org.example;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.Socket;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public class RequestHandler {
    public void handle(Socket clientSocket) {
        try (BufferedReader in = new BufferedReader(new InputStreamReader(clientSocket.getInputStream()));
             OutputStream out = clientSocket.getOutputStream()) {

            HttpRequest request = parseRequest(in);
            if(request != null) {
                System.out.println("Request Line: " + request.getRequestLine());
                System.out.println("Headers: " + request.getHeaders());
                System.out.println("Body: " + request.getBody());
                HttpResponse response = createResponse(request);
                sendResponse(out, response);
            }
            else{
                String content = "{\"status\":\"success\", \"message\":\"unknown operation\"}";
                sendResponse(out,new HttpResponse(200, "OK", "application/json", content,"any",null,null));
            }
        }
        catch (IOException e) {
            System.err.println("Error handling client: " + e.getMessage());
        }
        finally {
            closeSocket(clientSocket);
        }
    }

    private HttpRequest parseRequest(BufferedReader in) throws IOException {
        String requestLine = in.readLine();
        if (requestLine == null) {
            throw new IOException("Empty request");
        }
        if (requestLine.startsWith("OPTIONS")) {
            return null;
        }

        List<String> headers = new ArrayList<>();
        String line;
        while ((line = in.readLine()) != null && !line.isEmpty()) {
            headers.add(line);
        }

        Boolean hasAccessToken = false;
        Boolean hasRefreshToken = false;
        String accessToken = null;
        String refreshToken = null;
        for (String header : headers) {
            if (header.toLowerCase().startsWith("cookie:")) {
                String cookieHeader = header.substring(header.indexOf(':') + 1).trim();
                String[] cookiePairs = cookieHeader.split(";");

                for (String cookiePair : cookiePairs) {
                    cookiePair = cookiePair.trim();
                    int equalsIndex = cookiePair.indexOf('=');
                    if (equalsIndex > 0) {
                        String name = cookiePair.substring(0, equalsIndex).trim();
                        String value = cookiePair.substring(equalsIndex + 1).trim();

                        if (name.equals("access_token")) {
                            accessToken = value.split(";")[0];
                            hasAccessToken = true;
                        }
                        else if (name.equals("refresh_token")) {
                            refreshToken = value.split(",|;")[0].trim();
                            hasRefreshToken = true;
                        }
                    }

                    if (hasAccessToken && hasRefreshToken) break;
                }
            }
        }

        Boolean hasBody = false;
        int contentLength = 0;
        for(String header : headers) {
            if(header.startsWith("Content-Length:")) {
                contentLength = Integer.parseInt(header.substring(15).trim());
                hasBody = true;
            }
        }
        String body = null;
        if (hasBody) {
            char[] bodyBytes = new char[contentLength];
            in.read(bodyBytes, 0, contentLength);
            body = new String(bodyBytes);
        }
        return new HttpRequest(requestLine, headers, body, accessToken, refreshToken);
    }

    private HttpResponse createResponse(HttpRequest request) {
        String content;
        String requestLine = request.getRequestLine();
        String accessToken = request.getAccessToken();
        String refreshToken = request.getRefreshToken();
        if(requestLine.contains("/register")){
            Register register = new Register(request);
            content = register.status();
            boolean created = register.created();
            if(created) return new HttpResponse(200, "OK", "application/json", content,"/register",null,null);
            else return new HttpResponse(409, "Conflict", "application/json", content, "/register",null,null);
        }
        else if(requestLine.contains("/login")){
            Login login = new Login(request);
            content = login.status();
            boolean valid = login.valid();
            if(valid) return new HttpResponse(200, "OK", "application/json", content, "/login",login.getAccessToken(), login.getRefreshToken());
            else return new HttpResponse(401, "Unauthorized", "application/json", content, "/login",null,null);
        }
        else if(requestLine.contains("/logged")) {
            try{
                if (accessToken != null && JWT.validateToken(accessToken) && !RevokedUserAccessTokens.isItRevoked(RevokedUserAccessTokens.getUserId(JWT.getEmailFromToken(accessToken)), accessToken, refreshToken)) {
                    content = "{\"status\":\"success\", \"message\":\"valid access token\"}";
                    return new HttpResponse(200, "OK", "application/json", content, "/logged", null, null);
                }
                else if (refreshToken != null && JWT.validateToken(refreshToken) && !RevokedUserAccessTokens.isItRevoked(RevokedUserAccessTokens.getUserId(JWT.getEmailFromToken(refreshToken)), accessToken, refreshToken)) {
                    content = "{\"status\":\"success\", \"message\":\"valid refresh token\"}";
                    return new HttpResponse(200, "OK", "application/json", content, "/logged", JWT.generateAccessToken(JWT.getEmailFromToken(refreshToken)), null);
                }
            }
            catch(SQLException e){
                e.printStackTrace();
            }
            content = "{\"status\":\"failed\", \"message\":\"User hasn't been authenticated\"}";
            return new HttpResponse(401, "Unauthorized", "application/json", content, "/logged",null,null);
        }
        else if(requestLine.contains("/logout")) {
            try{
                if (refreshToken != null) RevokedUserAccessTokens.addTokens(RevokedUserAccessTokens.getUserId(JWT.getEmailFromToken(refreshToken)), accessToken, refreshToken);
            }
            catch(SQLException e){
                e.printStackTrace();
            }
            content = "{\"status\":\"success\", \"message\":\"User has been logged out\"}";
            return new HttpResponse(200, "OK", "application/json", content,"/logout",null,null);
        }
        else {
            content = "{\"status\":\"success\", \"message\":\"unknown operation\"}";
            return new HttpResponse(200, "OK", "application/json", content, "any",null,null);
        }
    }

    private void sendResponse(OutputStream out, HttpResponse response) throws IOException {
        out.write(response.getHeaders().getBytes());
        out.write(response.getContent().getBytes());
        out.flush();
    }

    private void closeSocket(Socket socket) {
        try {
            socket.close();
        }
        catch (IOException e) {
            System.err.println("Error closing socket: " + e.getMessage());
        }
    }
}