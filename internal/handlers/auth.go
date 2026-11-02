package handlers

import (
	"fmt"
	"gravity-go/internal/auth"
	"gravity-go/internal/database"
	"gravity-go/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

func SignupHandler(c *gin.Context) {
	var user models.SignupRequest

	if err := c.ShouldBindJSON(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to validate data against schema"})
		fmt.Println(err)
		return
	}

	hashedPassword, err := auth.HashPassword(user.Password)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Error occurred"})
		fmt.Println(err)
		return
	}

	err = database.SaveUserIntoDatabase(user.Email, hashedPassword)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to save user to database"})
		fmt.Println(err)
		return
	}

	token, err := auth.CreateJWTToken(user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create token"})
		fmt.Println(err)
		return
	}

	c.SetCookie("token", token, 3600, "/", "", false, true)
	c.Redirect(http.StatusFound, "/")
}

func SigninHandler(c *gin.Context) {
	var user models.SignInRequest
	if err := c.ShouldBindJSON(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to validate data against schema"})
		fmt.Println(err)
		return
	}

	originalUser, err := database.GetUserFromDatabase(user.Email)
	if err != nil {
		fmt.Println(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to get user from database"})
		return
	}

	passwordMatches := auth.CheckPassword(user.Password, originalUser.Password)
	if !passwordMatches {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid password"})
		return
	}

	token, err := auth.CreateJWTToken(user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create token"})
		return
	}

	c.SetCookie("token", token, 3600, "/", "", false, true)
	c.Redirect(http.StatusFound, "/")
}
