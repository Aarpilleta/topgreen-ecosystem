# TOP GREEN Automated Ecosystem Launcher

Write-Host '==============================================' -ForegroundColor Green
Write-Host '      Lanzador del Ecosistema TOP GREEN' -ForegroundColor Green
Write-Host '==============================================' -ForegroundColor Green

# 1. Verify environment file
$backendEnv = Join-Path (Get-Item .).FullName 'whatsapp-backend\.env'
$backendEnvExample = Join-Path (Get-Item .).FullName 'whatsapp-backend\.env.example'

if (-not (Test-Path $backendEnv)) {
    Write-Host '[!] Archivo .env no encontrado en whatsapp-backend.' -ForegroundColor Yellow
    Write-Host '[*] Copiando de .env.example...' -ForegroundColor Gray
    Copy-Item $backendEnvExample $backendEnv
    Write-Host '[!] CREADO: whatsapp-backend/.env' -ForegroundColor Yellow
    Write-Host '[!] IMPORTANTE: Por favor abre whatsapp-backend/.env y configura tu GEMINI_API_KEY.' -ForegroundColor Red
} else {
    $envContent = Get-Content $backendEnv -Raw
    if ($envContent -like '*YOUR_GEMINI_API_KEY_HERE*') {
        Write-Host '[!] ADVERTENCIA: La variable GEMINI_API_KEY en whatsapp-backend/.env no está configurada aún.' -ForegroundColor Yellow
    }
}

# 2. Launch Backend in a new window with auto-restart loop
Write-Host '[+] Iniciando Servidor de Producción (Express) con auto-reinicio...' -ForegroundColor Green
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd whatsapp-backend; while ($true) { node server.js; Start-Sleep -Seconds 5 }' -WindowStyle Normal

Write-Host '----------------------------------------------' -ForegroundColor Gray
Write-Host '[✔] El servidor ha sido lanzado en una terminal independiente.' -ForegroundColor Green
Write-Host '[*] Workspace Unificado (Dashboard + Consola WA): http://localhost:5000' -ForegroundColor Gray
Write-Host '==============================================' -ForegroundColor Green
