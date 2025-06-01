package org.example;
import java.sql.*;

public class UserDAO {
private Connection connection;

public UserDAO(Connection connection) {
    this.connection = connection;
}

public void createUser(User user) throws SQLException {
    String sql = "INSERT INTO users (email, password) VALUES (?,?)";
    try(PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
        statement.setString(1, user.getEmail());
        statement.setString(2, user.getPassword());
        statement.executeUpdate();
        try(ResultSet generatedKeys = statement.getGeneratedKeys()) {
            if(generatedKeys.next()) {
                user.setId(generatedKeys.getInt(1));
            }
        }
    }
 }

 public User findUserByEmail(String email) throws SQLException {
    String sql = "SELECT * FROM users WHERE email = ?";
    try(PreparedStatement statement = connection.prepareStatement(sql)) {
        statement.setString(1, email);
        try(ResultSet resultSet = statement.executeQuery()) {
            if(resultSet.next()) {
                int user_id = resultSet.getInt("user_id");
                String password = resultSet.getString("password");
                User user = new User(email,password);
                user.setId(user_id);
                return user;
            }
        }
    }
     return null;
    }

    public boolean isValid(String email, String password) throws SQLException {
    String sql = "SELECT * FROM users WHERE email = ? AND password = ?";
    try(PreparedStatement statement = connection.prepareStatement(sql)) {
        statement.setString(1, email);
        statement.setString(2, password);
        try(ResultSet resultSet = statement.executeQuery()) {
            if(resultSet.next()) {
                return true;
            }
        }
    }
    return false;
    }
 }
