#!/usr/bin/env python3
"""
Script para aplicar migrações SQL no Supabase usando PostgreSQL psycopg2
Este script não depende do MCP e funciona diretamente com o banco PostgreSQL

Requer: pip install psycopg2-binary
"""

import os
import sys
import psycopg2
from pathlib import Path
from psycopg2 import sql

# ========================================
# Configurações
# ========================================

SUPABASE_HOST = "db.vkxgsejuqouozsejalhj.supabase.co"
SUPABASE_PORT = 5432
SUPABASE_USER = "postgres"
SUPABASE_PASSWORD = None  # Será pedido durante execução
SUPABASE_DB = "postgres"

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
        return None

    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

def execute_sql(conn, sql_script: str) -> bool:
    """Executa script SQL completo"""
    try:
        cursor = conn.cursor()

        # Executar o script completo
        cursor.execute(sql_script)
        conn.commit()

        cursor.close()
        print("✅ SQL executado com sucesso")
        return True

    except psycopg2.Error as e:
        conn.rollback()
        print(f"❌ Erro ao executar SQL: {e}")
        return False
    except Exception as e:
        print(f"❌ Erro inesperado: {e}")
        return False

def verify_tables(conn) -> list:
    """Verifica tabelas criadas no schema public"""
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """)

        tables = [row[0] for row in cursor.fetchall()]
        cursor.close()
        return tables

    except Exception as e:
        print(f"❌ Erro ao verificar tabelas: {e}")
        return []

def verify_rls(conn) -> dict:
    """Verifica se RLS está habilitado"""
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT tablename, rowsecurity
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename;
        """)

        rls_status = {row[0]: row[1] for row in cursor.fetchall()}
        cursor.close()
        return rls_status

    except Exception as e:
        print(f"❌ Erro ao verificar RLS: {e}")
        return {}

def main():
    print("=" * 70)
    print("🔧 Executor de Migrações Supabase (PostgreSQL)")
    print("=" * 70)
    print()

    print(f"Host: {SUPABASE_HOST}")
    print(f"Port: {SUPABASE_PORT}")
    print(f"User: {SUPABASE_USER}")
    print(f"Database: {SUPABASE_DB}")
    print()

    # Solicitar senha
    import getpass
    try:
        password = getpass.getpass("🔐 Digite a senha do Postgres (database password): ")
    except KeyboardInterrupt:
        print("\n❌ Operação cancelada")
        return

    print()

    # Conectar ao Supabase
    print("🔌 Conectando ao Supabase PostgreSQL...")
    try:
        conn = psycopg2.connect(
            host=SUPABASE_HOST,
            port=SUPABASE_PORT,
            user=SUPABASE_USER,
            password=password,
            database=SUPABASE_DB
        )
        print("✅ Conectado ao Supabase com sucesso!")
    except psycopg2.Error as e:
        print(f"❌ Erro ao conectar: {e}")
        print()
        print("💡 Dicas:")
        print("  1. Verifique a senha correta")
        print("  2. Verifique se está na rede correta (sem firewall bloqueando 5432)")
        print("  3. Verifique credenciais do Supabase Dashboard")
        return

    print()

    # Verificar migrações
    print("📋 Verificando migrações disponíveis...")
    if not MIGRATIONS_DIR.exists():
        print(f"❌ Diretório de migrações não encontrado: {MIGRATIONS_DIR}")
        conn.close()
        return

    migrations = sorted([f.name for f in MIGRATIONS_DIR.glob("*.sql")])
    if not migrations:
        print("❌ Nenhuma arquivo .sql encontrado em supabase/migrations/")
        conn.close()
        return

    for i, migration in enumerate(migrations, 1):
        print(f"  {i}. {migration}")

    print()

    # Executar migrações
    print("=" * 70)
    print("▶️  Executando Migrações")
    print("=" * 70)
    print()

    success_count = 0
    for i, migration in enumerate(migrations, 1):
        print(f"[{i}/{len(migrations)}] Executando: {migration}")

        sql_script = load_migration(migration)
        if sql_script is None:
            continue

        if execute_sql(conn, sql_script):
            success_count += 1

        print()

    # Verificar resultados
    print("=" * 70)
    print("✅ Verificação de Resultados")
    print("=" * 70)
    print()

    tables = verify_tables(conn)
    print(f"📊 Tabelas criadas: {len(tables)}")
    if tables:
        for table in tables:
            print(f"  ✓ {table}")
    print()

    rls_status = verify_rls(conn)
    print(f"🔐 RLS Status: {len([t for t in rls_status.values() if t])} tabelas com RLS habilitado")
    for table, enabled in rls_status.items():
        status = "✓ HABILITADO" if enabled else "✗ Desabilitado"
        print(f"  {status}: {table}")
    print()

    # Fechar conexão
    conn.close()

    # Resultado final
    print("=" * 70)
    if success_count == len(migrations):
        print(f"✅ SUCESSO! {success_count}/{len(migrations)} migrações executadas")
        print("=" * 70)
    else:
        print(f"⚠️  PARCIAL: {success_count}/{len(migrations)} migrações executadas com sucesso")
        print("=" * 70)

    print()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n❌ Script interrompido pelo usuário")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Erro fatal: {e}")
        sys.exit(1)
