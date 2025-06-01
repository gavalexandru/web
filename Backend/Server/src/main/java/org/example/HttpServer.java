package org.example;

import java.io.IOException;
import java.net.ServerSocket;
import java.net.Socket;

public class HttpServer {
    private static final int PORT = 8082;
    private final ServerSocket serverSocket;
    private final RequestHandler requestHandler;

    public HttpServer() throws IOException {
        this.serverSocket = new ServerSocket(PORT);
        this.requestHandler = new RequestHandler();
        System.out.println("Server running on http://localhost:" + PORT);
    }

    public void start() {
        try {
            while (true) {
                Socket clientSocket = serverSocket.accept();
                new Thread(() -> requestHandler.handle(clientSocket)).start();
            }
        }
        catch (IOException e) {
            System.err.println("Server error: " + e.getMessage());
        }
        finally {
            stop();
        }
    }

    public void stop() {
        try {
            serverSocket.close();
        }
        catch (IOException e) {
            System.err.println("Error closing server: " + e.getMessage());
        }
    }

    public static void main(String[] args) throws IOException {
        new HttpServer().start();
    }
}