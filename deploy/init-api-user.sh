#!/bin/sh
set -eu
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 --set=api_password="$API_DATABASE_PASSWORD" <<'SQL'
CREATE ROLE foodmap_api LOGIN PASSWORD :'api_password';
SQL
