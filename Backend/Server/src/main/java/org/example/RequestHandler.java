package org.example;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.Socket;
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
                sendResponse(out,new HttpResponse(200, "OK", "application/json", content));
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

        return new HttpRequest(requestLine, headers, body);
    }

    private HttpResponse createResponse(HttpRequest request) {
        String content;
        if(request.getRequestLine().contains("/register")){
            Register register = new Register(request);
            content = register.status();
            boolean created = register.created();
            if(created) return new HttpResponse(200, "OK", "application/json", content);
                else return new HttpResponse(409, "Conflict", "application/json", content);
        }
        else if(request.getRequestLine().contains("/login")){
            Login login = new Login(request);
            content = login.status();
            boolean valid = login.valid();
            if(valid) return new HttpResponse(200, "OK", "application/json", content);
            else return new HttpResponse(409, "Conflict", "application/json", content);
        }
        else {
            content = "{\"status\":\"success\", \"message\":\"unknown operation\"}";
            return new HttpResponse(200, "OK", "application/json", content);
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