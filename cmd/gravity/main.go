package main

import (
	"gravity-go/internal/database"
	"gravity-go/internal/routes"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	if err := database.Init(); err != nil {
		log.Fatal(err)
	}

	defer database.DB.Close()

	r := gin.Default()
	routes.Setup(r)
	err := r.Run("localhost:8080")

	if err != nil {
		panic(err)
	}
}
