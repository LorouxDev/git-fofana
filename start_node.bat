@echo off
echo ========================================
echo   DEMARRAGE DU SERVEUR NODE.JS
echo ========================================
echo.
echo Installation des dependances...
call npm install
echo.
echo Demarrage du serveur...
echo.
echo Le serveur va demarrer sur http://localhost:8000
echo Ouvrez cette URL dans votre navigateur
echo.
echo Appuyez sur Ctrl+C pour arreter le serveur
echo.

node server.js

pause

