#!/usr/bin/env python3
"""
Script para executar migrações SQL no Supabase
Requer: pip install supabase
"""

import sys
import os
from pathlib import Path

# Tentar importar supabase
try:
    from supabase import create_client, Client
except ImportError:
    print("❌ Erro: supabase não está instalado")
    print("Instale com: pip install supabase")
    sys.exit(1)

# ========================================
# Configurações
# ========================================

SUPABASE_URL = "https://vkxgsejuqouozsejalhj.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZreGdzZWp1cW91b3pzZWphbGhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDkxNjgsImV4cCI6MjA4NjQyNTE2OH0.FdWqe4hGHDknTos4BghG60DOSewH3qRuqQFnlAamcSw"

PROJECT_ID = "vkxgsejuqouozsejalhj"
MIGRATIONS_DIR = Path(__file__).parent / "supabase" / "migrations"

# ========================================
# Funções
# ========================================

def load_migration(filename: str) -> str:
    """Carrega arquivo de migração SQL"""
    filepath = MIGRATIONS_DIR / filename
    if not filepath.exists():
        print(f"❌ Arquivo não encontrado: {filepath}")
        sys.exit(1)

    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

def execute_migration(client: Client, migration_sql: str) -> bool:
    """Executa uma migração SQL"""
    try:
        # Nota: Supabase SDK não executa SQL raw diretamente
        # Você precisa usar a API PostgreSQL diretamente ou o SQL Editor
        print("⚠️  SDK do Supabase não suporta SQL raw direto")
        print("Execute manualmente no Dashboard: https://supabase.com/dashboard")
        return False
    except Exception as e:
        print(f"❌ Erro ao executar migração: {e}")
        return False

def main():
    print("=" * 60)
    print("Executor de Migrações Supabase")
    print("=" * 60)
    print()

    print(f"Projeto: {PROJECT_ID}")
    print(f"URL: {SUPABASE_URL}")
    print()

    # Tentar conectar ao Supabase
    print("🔌 Conectando ao Supabase...")
    try:
        client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Conectado ao Supabase")
    except Exception as e:
        print(f"❌ Erro ao conectar: {e}")
        sys.exit(1)

    print()

    # Listar migrações
    print("📋 Migrações encontradas:")
    migrations = sorted([f.name for f in MIGRATIONS_DIR.glob("*.sql")])
    for i, migration in enumerate(migrations, 1):
        print(f"  {i}. {migration}")

    print()
    print("=" * 60)
    print("❌ PROBLEMA: SDK do Supabase não executa SQL raw")
    print("=" * 60)
    print()
    print("SOLUÇÃO: Execute manualmente no Supabase Dashboard")
    print()
    print("1. Abra: https://supabase.com/dashboard")
    print("2. Selecione projeto: vkxgsejuqouozsejalhj")
    print("3. Vá a: SQL Editor → New Query")
    print("4. Copie conteúdo de: 001_initial_schema.sql")
    print("5. Execute (Ctrl+Enter ou botão Run)")
    print("6. Repita passos 3-5 para: 002_rls_policies.sql")
    print()
    print("Veja arquivo: EXECUTAR_MIGRACAO.md")
    print()

if __name__ == "__main__":
    main()
