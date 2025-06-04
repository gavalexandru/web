package org.example;
import java.sql.*;

public class RevokedUserAccessTokens {
    private final static Connection connection = DatabaseConnectionManager.getInstance().getConnection();
    public static void addTokens(int userId, String accessToken, String refreshToken) throws SQLException {
        String sql = "INSERT INTO logged (user_id,access_token, refresh_token) VALUES (?,?,?)";
        try(PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            statement.setInt(1, userId);
            statement.setString(2, accessToken);
            statement.setString(3, refreshToken);
            statement.executeUpdate();
        }
    }
    public static boolean isItRevoked(int userId, String accessToken, String refreshToken) throws SQLException {
        String sql = "SELECT * FROM logged WHERE user_id = ?  AND access_token = ? AND refresh_token = ?";
        try(PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, userId);
            statement.setString(2, accessToken);
            statement.setString(3, refreshToken);
            try(ResultSet resultSet = statement.executeQuery()) {
                if(resultSet.next()) {
                    return true;
                }
            }
        }
        return false;
    }
    public static int getUserId(String email) throws SQLException {
        UserDAO userDAO = new UserDAO(connection);
        return userDAO.findUserByEmail(email).getId();
    }
}
