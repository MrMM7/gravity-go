package routes

import (
	"gravity-go/internal/handlers"
	"gravity-go/internal/web"

	"github.com/gin-gonic/gin"
)

func Setup(r *gin.Engine) {
	// Frontend Web Routes
	web.RegisterRoutes(r)

	// URL Shortener Core Routes
	r.POST("/api/v1/shorten", handlers.ShortenHandler)
	r.GET("/:code", handlers.RedirectHandler)

	// Authentication Routes
	r.POST("/api/v1/signup", handlers.SignupHandler)
	r.POST("/api/v1/signin", handlers.SigninHandler)
}
