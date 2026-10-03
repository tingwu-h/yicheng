@echo off
chcp 65001 >nul
title Yicheng - Local Preview
cd /d "%~dp0"
where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js 24 or later is required. Please install Node.js, then try again.
  pause
  exit /b 1
)
node "tools/start-local.mjs"
if errorlevel 1 pause
