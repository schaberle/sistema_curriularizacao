@echo off
REM ========================================
REM Script para Executar Migrações no Supabase (Windows)
REM ========================================

setlocal enabledelayedexpansion

REM Cores (Windows 10+)
color 0A

echo.
echo ========================================
echo Executando Migrações Supabase
echo ========================================
echo.

REM Configurações
set PROJECT_ID=vkxgsejuqouozsejalhj
set SUPABASE_URL=https://vkxgsejuqouozsejalhj.supabase.co
set SUPABASE_HOST=db.vkxgsejuqouozsejalhj.supabase.co
set SUPABASE_USER=postgres

echo Projeto: %PROJECT_ID%
echo URL: %SUPABASE_URL%
echo.

REM Verificar se arquivo de migração existe
if not exist "supabase\migrations\001_initial_schema.sql" (
    echo ERRO: Arquivo supabase\migrations\001_initial_schema.sql nao encontrado
    pause
    exit /b 1
)

if not exist "supabase\migrations\002_rls_policies.sql" (
    echo ERRO: Arquivo supabase\migrations\002_rls_policies.sql nao encontrado
    pause
    exit /b 1
)

echo [1/2] Executando Migração 001 (Criar Tabelas)...
REM Se tiver psql instalado, execute:
REM psql -h %SUPABASE_HOST% -U %SUPABASE_USER% -d postgres -f supabase\migrations\001_initial_schema.sql

echo.
echo IMPORTANTE: Este script requer:
echo   1. psql (PostgreSQL client) instalado
echo   2. Senha do banco de dados
echo.
echo Alternativa RECOMENDADA: Execute as migrações manualmente no Supabase Dashboard
echo https://supabase.com/dashboard
echo.
echo Veja arquivo EXECUTAR_MIGRACAO.md para instruções passo-a-passo
echo.
pause
