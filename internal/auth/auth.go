package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/argon2"
)

func getSecret() ([]byte, error) {
	s := os.Getenv("JWT_SECURE_KEY")
	if s == "" {
		return nil, errors.New("JWT_SECURE_KEY is empty")
	}
	return []byte(s), nil
}

func CreateJWTToken(email string) (string, error) {
	secret, err := getSecret()
	if err != nil {
		return "", err
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"email": email,
		"exp":   jwt.NewNumericDate(time.Now().Add(7 * 26 * time.Hour)),
	})
	if len(secret) == 0 {
		return "", errors.New("JWT_SECURE_KEY is empty")
	}
	s, err := t.SignedString(secret)

	if err != nil {
		return "", err
	}
	return s, nil
}

func ValidateJWTToken(tokenString string) (bool, error) {
	secret, err := getSecret()
	if err != nil {
		return false, err
	}
	token, err := jwt.Parse(
		tokenString,
		func(t *jwt.Token) (any, error) {
			return secret, nil
		},
		jwt.WithValidMethods([]string{"HS256"}),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return false, err
	}

	return token.Valid, nil
}

func HashPassword(password string) (string, error) {
	salt := make([]byte, 16)

	if _, err := rand.Read(salt); err != nil {
		return "", err
	}

	hash := argon2.IDKey(
		[]byte(password),
		salt,
		3,       // iterations
		64*1024, // memory (64 MB)
		2,       // parallelism
		32,      // output length
	)

	return hex.EncodeToString(salt) + ":" +
		hex.EncodeToString(hash), nil
}

func CheckPassword(password, passwordHash string) bool {
	parts := strings.Split(passwordHash, ":")
	if len(parts) != 2 {
		return false
	}

	salt, err := hex.DecodeString(parts[0])
	if err != nil {
		return false
	}

	expectedHash, err := hex.DecodeString(parts[1])
	if err != nil || len(expectedHash) != 32 {
		return false
	}

	actualHash := argon2.IDKey(
		[]byte(password),
		salt,
		3,
		64*1024,
		2,
		32,
	)

	return subtle.ConstantTimeCompare(actualHash, expectedHash) == 1
}
