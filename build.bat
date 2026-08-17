@echo off
echo Running build process...
cd android
call gradlew assembleDebug
