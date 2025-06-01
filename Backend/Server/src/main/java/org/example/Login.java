package org.example;

import com.google.gson.Gson;
import java.sql.*;

public class Login {
    private final String email;
    private final String password;
    private  final HttpRequest request;
    private boolean valid;
    public Login(HttpRequest request){
        this.request = request;
        Gson gson = new Gson();
        User user = gson.fromJson(request.getBody(), User.class);
        email = user.getEmail();
        password = user.getPassword();
        Connection connection = DatabaseConnectionManager.getInstance().getConnection();
        UserDAO object = new UserDAO(connection);
        try{
            if(object.isValid(email, password)) valid = true;
            else valid = false;
        }
        catch(SQLException e){
            e.printStackTrace();
        }
    }

    public boolean valid(){
        return valid;
    }

    public String status(){
        String answer;
        String jwtToken;
        if(valid){
            jwtToken = JWT.generateToken(email);
            answer = "{\"status\":\"success\", \"token\":\"" + jwtToken + "\"}";
        }
        else answer = "{\"status\":\"failed\", \"message\":\"Incorrect email or password\"}";
        return answer;
    }
}
