package org.example;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import javax.crypto.SecretKey;
import java.util.Date;

public class JWT {
    private static final String secretKey = "7A24432646294A404E635266556A586E3272357538782F413F4428472B4B6150";
    private static final long expirationTime = 900000; //15 minutes in miliseconds for access_token
    private static final long longerExpiration = 604800000; //7 days in miliseconds for refresh_token

    public static String generateAccessToken(String email) {
        SecretKey key = Keys.hmacShaKeyFor(secretKey.getBytes());
        return Jwts.builder()
                .subject(email)
                .expiration(new Date(System.currentTimeMillis() + expirationTime))
                .signWith(key)
                .compact();
    }

    public static String generateRefreshToken(String email) {
        SecretKey key = Keys.hmacShaKeyFor(secretKey.getBytes());
        return Jwts.builder()
                .subject(email)
                .expiration(new Date(System.currentTimeMillis() + longerExpiration))
                .signWith(key)
                .compact();
    }

    public static boolean validateToken(String token) {
        try {
            SecretKey key = Keys.hmacShaKeyFor(secretKey.getBytes());
            Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            Date expiration = claims.getExpiration();
            return expiration.after(new Date());
        }
        catch (Exception e) {
            return false;
        }
    }

    public static String getEmailFromToken(String token) {
        SecretKey key = Keys.hmacShaKeyFor(secretKey.getBytes());
        Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        return claims.getSubject();
    }
}