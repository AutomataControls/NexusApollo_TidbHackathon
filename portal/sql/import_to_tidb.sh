#!/bin/bash

# TiDB Import Script for Apollo Nexus Demo Data
# This script imports demo vector data into TiDB Cloud for the hackathon

echo "🚀 Importing demo data to TiDB Cloud..."

# Connection parameters from .env
TIDB_HOST="gateway01.us-east-1.prod.aws.tidbcloud.com"
TIDB_PORT="4000"
TIDB_USER="2tMS4k3uDLyw1Ax.root"
TIDB_PASSWORD="54VirwknDKtBvNSR"
TIDB_DATABASE="test"
CA_PATH="/home/Automata/Downloads/isrgrootx1.pem"

# Check if CA certificate exists
if [ ! -f "$CA_PATH" ]; then
    echo "❌ CA certificate not found at $CA_PATH"
    echo "Please download it from TiDB Cloud console"
    exit 1
fi

# Check if SQL file exists
SQL_FILE="./tidb_demo_data.sql"
if [ ! -f "$SQL_FILE" ]; then
    echo "❌ SQL file not found at $SQL_FILE"
    exit 1
fi

echo "📊 Connecting to TiDB Cloud..."
echo "Host: $TIDB_HOST"
echo "Database: $TIDB_DATABASE"

# Import the data (MariaDB client uses different SSL options)
mysql --comments \
    --connect-timeout 150 \
    -u "$TIDB_USER" \
    -h "$TIDB_HOST" \
    -P "$TIDB_PORT" \
    -D "$TIDB_DATABASE" \
    --ssl \
    --ssl-ca="$CA_PATH" \
    -p"$TIDB_PASSWORD" < "$SQL_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Demo data imported successfully!"
    echo ""
    echo "📈 Verifying data import..."

    # Verify the import
    mysql --connect-timeout 150 \
        -u "$TIDB_USER" \
        -h "$TIDB_HOST" \
        -P "$TIDB_PORT" \
        -D "$TIDB_DATABASE" \
        --ssl \
        --ssl-ca="$CA_PATH" \
        -p"$TIDB_PASSWORD" \
        -e "SELECT 'Fault Patterns' as Table_Name, COUNT(*) as Count FROM fault_pattern_vectors
            UNION ALL SELECT 'Solutions', COUNT(*) FROM solution_vectors
            UNION ALL SELECT 'Sensor Embeddings', COUNT(*) FROM sensor_embeddings
            UNION ALL SELECT 'Model Inferences', COUNT(*) FROM model_inference_vectors;"

    echo ""
    echo "🎉 TiDB Vector Search is ready for the hackathon demo!"
else
    echo "❌ Failed to import data to TiDB"
    echo "Please check your connection settings and try again"
    exit 1
fi