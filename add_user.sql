-- Insert user for Google OAuth login
INSERT INTO "user" (id, username, email, pfp)
VALUES (
    'user_' || substr(md5(random()::text), 1, 10),
    'alirehan',
    'ali.rehan2842@gmail.com',
    'default.png'
);

