package org.example;
import com.google.gson.Gson;
import java.sql.*;

public class Register {
    private final String email;
    private final String password;
    private final HttpRequest request;
    private boolean created;
    public Register(HttpRequest request){
        this.request = request;
        Gson gson = new Gson();
        User user = gson.fromJson(request.getBody(), User.class);
        email = user.getEmail();
        password = user.getPassword();
        Connection connection = DatabaseConnectionManager.getInstance().getConnection();
        UserDAO object = new UserDAO(connection);
        try {
            if (object.findUserByEmail(email) == null){
                object.createUser(new User(email, password));
                created = true;
            }
            else created = false;
        }
        catch (SQLException e){
            e.printStackTrace();
        }
    }
    public String status(){
        String answer;
        if(created) answer="{\"status\":\"success\", \"message\":\"The account has been registered with success\"}";
                else answer="{\"status\":\"failed\", \"message\":\"The account already exists\"}";
        return answer;
    }

    public boolean created(){
        return created;
    }
}
