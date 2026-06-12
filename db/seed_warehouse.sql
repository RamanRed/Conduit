CREATE SCHEMA IF NOT EXISTS conduit;

CREATE TABLE IF NOT EXISTS conduit.warehouse_units (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL UNIQUE,
    unit_type VARCHAR NOT NULL,
    connection_secret_id VARCHAR NOT NULL
);

CREATE TABLE IF NOT EXISTS conduit.sub_projects (
    id SERIAL PRIMARY KEY,
    warehouse_id INT REFERENCES conduit.warehouse_units(id) ON DELETE CASCADE,
    name VARCHAR,
    description TEXT,
    data_role VARCHAR DEFAULT 'PERSISTENT',
    data_owner VARCHAR,
    business_kpi_impact TEXT
);

CREATE TABLE IF NOT EXISTS conduit.tables_metadata (
    id SERIAL PRIMARY KEY,
    sub_project_id INT REFERENCES conduit.sub_projects(id) ON DELETE CASCADE,
    table_name VARCHAR,
    semantic_description TEXT,
    storage_location_uri VARCHAR,
    file_format_type VARCHAR,
    version_number INT DEFAULT 1,
    aliases VARCHAR[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_mutated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conduit.attributes_metadata (
    id SERIAL PRIMARY KEY,
    table_id INT REFERENCES conduit.tables_metadata(id) ON DELETE CASCADE,
    column_name VARCHAR,
    data_type VARCHAR,
    semantic_description TEXT,
    is_required BOOLEAN DEFAULT FALSE,
    is_pii BOOLEAN DEFAULT FALSE,
    anomaly_threshold FLOAT DEFAULT 0.05,
    sample_values VARCHAR[] DEFAULT '{}'
);

INSERT INTO conduit.warehouse_units (name, unit_type, connection_secret_id) 
VALUES ('Production_Warehouse_PG', 'POSTGRES', 'local_env_secret');

INSERT INTO conduit.sub_projects 
  (warehouse_id, name, description, data_role, data_owner, business_kpi_impact)
VALUES (1, 'E-Commerce Core', 
  'Core transactional data from the e-commerce platform including orders, customers, and products', 
  'PERSISTENT', 'Data Engineering Team',
  'Directly feeds monthly revenue dashboard and customer LTV calculations');

INSERT INTO conduit.tables_metadata 
  (sub_project_id, table_name, semantic_description, storage_location_uri, file_format_type)
VALUES (1, 'orders_clean', 
  'Cleaned and validated order records from all sales channels. Primary source for revenue reporting.',
  'postgresql://warehouse/public/orders_clean', 'PARQUET');

INSERT INTO conduit.attributes_metadata 
  (table_id, column_name, data_type, semantic_description, is_required, is_pii, sample_values)
VALUES
  (1, 'order_id', 'INT', 'Unique order identifier', true, false, ARRAY['1001','1002','1003']),
  (1, 'customer_id', 'INT', 'Reference to customer record', true, false, ARRAY['501','502']),
  (1, 'amount_usd', 'DECIMAL', 'Order total in USD after discounts', true, false, ARRAY['49.99','129.00']),
  (1, 'order_status', 'VARCHAR', 'Current fulfillment status', true, false, ARRAY['completed','pending','cancelled']),
  (1, 'customer_email', 'VARCHAR', 'Customer contact email', true, true, ARRAY['user@example.com']),
  (1, 'created_at', 'TIMESTAMP', 'Order creation timestamp', true, false, ARRAY['2024-01-15 10:30:00']),
  (1, 'processed_at', 'TIMESTAMP', 'Pipeline processing timestamp', false, false, ARRAY[]::VARCHAR[]);

CREATE TABLE IF NOT EXISTS public.orders_clean (
  order_id INT,
  customer_id INT,
  amount_usd DECIMAL(10,2),
  order_status VARCHAR(50),
  customer_email VARCHAR(255),
  created_at TIMESTAMP,
  processed_at TIMESTAMP,
  amount_tier VARCHAR(20),
  amount_outlier BOOLEAN,
  is_potential_duplicate BOOLEAN
);

