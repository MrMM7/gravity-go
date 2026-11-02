package database

import "gravity-go/internal/models"

func SaveURL(url *models.ShortenedURL) error {
	query := "INSERT INTO urls (short_code, original_url) VALUES (?, ?)"
	stmt, err := DB.Prepare(query)
	if err != nil {
		return err
	}
	defer stmt.Close()

	_, err = stmt.Exec(url.ShortCode, url.OriginalURL)
	if err != nil {
		return err
	}
	return nil
}

func GetURLFromShortCode(shortCode string) (string, error) {
	query := "SELECT original_url FROM urls WHERE short_code = ?"
	stmt, err := DB.Prepare(query)

	if err != nil {
		return "", err
	}

	defer stmt.Close()

	var url string
	err = stmt.QueryRow(shortCode).Scan(&url)
	if err != nil {
		return "", err
	}
	return url, nil
}
