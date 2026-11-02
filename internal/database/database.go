package database

import (
	"database/sql"
	"log"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func Init() error {
	db, err := sql.Open("sqlite3", "./main.db")

	if err != nil {
		return err
	}

	if err = db.Ping(); err != nil {
		return err
	}

	DB = db

	db.SetMaxIdleConns(100)
	db.SetMaxOpenConns(100)

	startingQuery := `
	CREATE TABLE IF NOT EXISTS urls (
	    short_code TEXT NOT NULL UNIQUE	PRIMARY KEY,
	    original_url TEXT NOT NULL
	)
`
	_, err = DB.Exec(startingQuery)
	if err != nil {
		log.Fatal(err)
	}
	return nil
}
