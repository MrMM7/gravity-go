package handlers

import (
	"gravity-go/internal/core"
	"gravity-go/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

func ShortenHandler(c *gin.Context) {
	var req models.ShortenedURL

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Shorten URL binding failed"})
		return
	}

	url, err := core.CreateShortenedURL(req.OriginalURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to create shortened url"})
		return
	}
	c.JSON(http.StatusCreated, models.ShortenedURL{
		OriginalURL: url.OriginalURL,
		ShortCode:   url.ShortCode,
	})
}

func RedirectHandler(c *gin.Context) {
	shortCode := c.Param("code")

	originalUrl, err := core.GetOriginalURLFromShortCode(shortCode)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to get originalUrl from shortened url"})
		return
	}

	c.Redirect(http.StatusFound, originalUrl)
}
