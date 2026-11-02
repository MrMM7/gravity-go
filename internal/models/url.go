package models

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
)

type ShortenedURL struct {
	OriginalURL string `binding:"required,url" json:"original_url"`
	ShortCode   string `json:"short_code"`
}

func (s *ShortenedURL) GenerateShortCode() error {
	bytes := make([]byte, 8)

	if _, err := rand.Read(bytes); err != nil {
		s.ShortCode = ""
		return errors.New("error generating random bytes: " + err.Error())
	}

	s.ShortCode = base64.RawURLEncoding.EncodeToString(bytes)
	return nil
}
