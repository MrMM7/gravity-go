package main

import (
	"gravity-go/internal/database"
	"gravity-go/internal/routes"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(".env"); err != nil {
		panic(err)
	}

	if err := database.Init(); err != nil {
		panic(err)
	}
	defer database.DB.Close()

	r := gin.Default()
	routes.Setup(r)
	err := r.Run("localhost:8080")

	if err != nil {
		panic(err)
	}
}
