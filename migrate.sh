#!/bin/bash

# ========================================
# Script para Executar Migrações no Supabase
# ========================================

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Executando Migrações Supabase${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Verificar se supabase-cli está instalado
if ! command -v supabase &> /dev/null
then
    echo -e "${RED}❌ supabase-cli não está instalado${NC}"
    echo "Instale com: npm install -g supabase"
    exit 1
fi

echo -e "${GREEN}✅ supabase-cli encontrado${NC}"
echo ""

# Configurações
PROJECT_ID="vkxgsejuqouozsejalhj"
SUPABASE_URL="https://vkxgsejuqouozsejalhj.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZreGdzZWp1cW91b3pzZWphbGhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDkxNjgsImV4cCI6MjA4NjQyNTE2OH0.FdWqe4hGHDknTos4BghG60DOSewH3qRuqQFnlAamcSw"

echo -e "${YELLOW}Projeto: ${PROJECT_ID}${NC}"
echo -e "${YELLOW}URL: ${SUPABASE_URL}${NC}"
echo ""

# Executar Migração 001
echo -e "${YELLOW}[1/2] Executando Migração 001 (Criar Tabelas)...${NC}"
psql -h db.vkxgsejuqouozsejalhj.supabase.co \
     -U postgres \
     -d postgres \
     -f supabase/migrations/001_initial_schema.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migração 001 executada com sucesso${NC}"
else
    echo -e "${RED}❌ Erro na Migração 001${NC}"
    exit 1
fi

echo ""

# Executar Migração 002
echo -e "${YELLOW}[2/2] Executando Migração 002 (RLS Policies)...${NC}"
psql -h db.vkxgsejuqouozsejalhj.supabase.co \
     -U postgres \
     -d postgres \
     -f supabase/migrations/002_rls_policies.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migração 002 executada com sucesso${NC}"
else
    echo -e "${RED}❌ Erro na Migração 002${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Todas as migrações executadas!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Verificar tabelas
echo -e "${YELLOW}Verificando tabelas criadas...${NC}"
psql -h db.vkxgsejuqouozsejalhj.supabase.co \
     -U postgres \
     -d postgres \
     -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
