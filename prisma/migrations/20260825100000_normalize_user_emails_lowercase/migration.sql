-- Store user emails in lowercase for case-insensitive login

UPDATE "User"
SET email = LOWER(TRIM(email))
WHERE email <> LOWER(TRIM(email));

UPDATE "PasswordResetToken"
SET email = LOWER(TRIM(email))
WHERE email <> LOWER(TRIM(email));
