@echo off
REM ============================================================================
REM Start PostgREST via Docker (native postgrest.exe blocked by Device Guard)
REM Container: indusia-postgrest, host port 3001 -> container 3000
REM ============================================================================

docker create --name indusia-postgrest ^
    -p 3001:3000 ^
    -e PGRST_DB_URI="postgres://indusia_user:LZU8nLlSeWsCj24Z@host.docker.internal:5432/indusia_db" ^
    -e PGRST_DB_SCHEMAS="public" ^
    -e PGRST_DB_ANON_ROLE="indusia_user" ^
    -e PGRST_JWT_SECRET="c102d75e7de1a92f0913ba0c195693df1e047c7468bf2a7e42aaa56c5f54b124" ^
    -e PGRST_JWT_AUD="local" ^
    --add-host=host.docker.internal:host-gateway ^
    postgrest/postgrest:latest >nul 2>&1

docker start -a indusia-postgrest
