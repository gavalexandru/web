package org.example;

public class User {
    private int id;
    private final String email;
    private final String password;
    public User(String email, String password) {
        this.email = email;
        this.password = password;
    }
    public int getId() {
        return id;
    }
    public void setId(int id) {
        this.id = id;
    }
    public String getEmail() {
        return email;
    }
    public String getPassword() {
        return password;
    }
}
