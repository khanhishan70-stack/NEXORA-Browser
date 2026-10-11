@echo off
cd /d "%~dp0stats"
echo NEXORA Mission Control: http://localhost:8099  (private, this PC only - leave this window open)
python server.py
pause
