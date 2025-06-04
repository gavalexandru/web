CREATE TABLE logged (
   user_id INTEGER REFERENCES users(user_id),
   access_token VARCHAR(512) NULL,
   refresh_token VARCHAR(512)
);