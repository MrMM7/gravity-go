package database

import "gravity-go/internal/models"

func SaveUserIntoDatabase(email, password string) error {
	query := `INSERT INTO users (email, password) VALUES (?, ?)`
	stmt, err := DB.Prepare(query)

	if err != nil {
		return err
	}
	defer stmt.Close()
	_, err = stmt.Exec(email, password)
	if err != nil {
		return err
	}

	return nil
}

func GetUserFromDatabase(email string) (models.SignInRequest, error) {
	query := `SELECT * FROM users WHERE email = ?`
	stmt, err := DB.Prepare(query)

	if err != nil {
		return models.SignInRequest{}, err
	}
	defer stmt.Close()

	row := stmt.QueryRow(email)
	var signInRequest models.SignInRequest
	err = row.Scan(&signInRequest.Email, &signInRequest.Password)
	if err != nil {
		return models.SignInRequest{}, err
	}
	return signInRequest, nil
}
