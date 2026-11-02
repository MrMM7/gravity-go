package core

import (
	"errors"
	"gravity-go/internal/database"
	"gravity-go/internal/models"
)

func CreateShortenedURL(originalURL string) (*models.ShortenedURL, error) {
	shortenedURL := &models.ShortenedURL{OriginalURL: originalURL}

	if err := shortenedURL.GenerateShortCode(); err != nil {
		return nil, errors.New("failed to generate short code" + err.Error())
	}

	if err := database.SaveURL(shortenedURL); err != nil {
		return nil, errors.New("failed to save shortened url" + err.Error())
	}

	return shortenedURL, nil
}

func GetOriginalURLFromShortCode(shortCode string) (string, error) {
	originalURL, err := database.GetURLFromShortCode(shortCode)

	if err != nil {
		return "", err
	}

	return originalURL, nil
}
