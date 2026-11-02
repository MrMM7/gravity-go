package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/argon2"
)

func CreateJWTToken(email string) (string, error) {
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"email": email})
	key := []byte(os.Getenv("JWT_SECURE_KEY"))
	if len(key) == 0 {
		return "", errors.New("JWT_SECURE_KEY is empty")
	}
	s, err := t.SignedString(key)

	if err != nil {
		return "", err
	}
	return s, nil
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
