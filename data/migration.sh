CREATE TABLE chart_configurations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE,
    config JSON
);


-- Create chart_configurations table
CREATE TABLE IF NOT EXISTS chart_configurations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    chart_type VARCHAR(20) NOT NULL,
    data_category VARCHAR(50) NOT NULL,
    config JSONB DEFAULT '{}',
    query_config JSONB DEFAULT '{}',
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create chart_data_cache table
CREATE TABLE IF NOT EXISTS chart_data_cache (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    data JSONB,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chart_config_name ON chart_configurations(name);
CREATE INDEX IF NOT EXISTS idx_chart_data_cache_key ON chart_data_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_chart_data_expires ON chart_data_cache(expires_at);

-- Insert default configurations
INSERT INTO chart_configurations (name, title, chart_type, data_category, is_default, display_order)
VALUES 
    ('weekly_activity', 'Weekly Activity', 'bar', 'tasks', TRUE, 1),
    ('status_distribution', 'Status Distribution', 'doughnut', 'tasks', TRUE, 2),
    ('monthly_trend', 'Monthly Trend', 'line', 'tasks', TRUE, 3),
    ('priority_distribution', 'Priority Distribution', 'pie', 'tasks', TRUE, 4)
ON CONFLICT (name) DO NOTHING;


alter table chart_configurations add title VARCHAR(200) NOT NULL;
alter table chart_configurations add data_category VARCHAR(50) NOT NULL;


CREATE TABLE IF NOT EXISTS chart_configurations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    chart_type VARCHAR(20) NOT NULL,
    data_category VARCHAR(50) NOT NULL,
    config JSON DEFAULT NULL,
    query_config JSON DEFAULT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_data_category (data_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create chart_data_cache table
CREATE TABLE IF NOT EXISTS chart_data_cache (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cache_key VARCHAR(255) NOT NULL UNIQUE,
    data JSON DEFAULT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cache_key (cache_key),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Insert default chart configurations
INSERT IGNORE INTO chart_configurations (name, title, chart_type, data_category, is_default, display_order)
VALUES 
    ('weekly_activity', 'Weekly Activity', 'bar', 'tasks', TRUE, 1),
    ('status_distribution', 'Status Distribution', 'doughnut', 'tasks', TRUE, 2),
    ('monthly_trend', 'Monthly Trend', 'line', 'tasks', TRUE, 3),
    ('priority_distribution', 'Priority Distribution', 'pie', 'tasks', TRUE, 4);




-- Add Attribute Reference Fields
ALTER TABLE users 
ADD COLUMN gender_attribute_id CHAR(36) NULL,
ADD COLUMN language_attribute_id CHAR(36) NULL,
ADD COLUMN currency_attribute_id CHAR(36) NULL,
ADD COLUMN country_attribute_id CHAR(36) NULL;

-- Add Location Fields from CTE
ALTER TABLE users 
ADD COLUMN location_id CHAR(36) NULL;

-- Add indexes for better performance (optional but recommended)
CREATE INDEX idx_users_gender_attribute ON users(gender_attribute_id);
CREATE INDEX idx_users_language_attribute ON users(language_attribute_id);
CREATE INDEX idx_users_currency_attribute ON users(currency_attribute_id);
CREATE INDEX idx_users_country_attribute ON users(country_attribute_id);
CREATE INDEX idx_users_location ON users(location_id);


-- Add missing columns to users table
ALTER TABLE users 
ADD COLUMN preferred_language VARCHAR(10) NOT NULL DEFAULT 'en',
ADD COLUMN preferred_timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
ADD COLUMN preferred_currency VARCHAR(3) NULL,
ADD COLUMN address VARCHAR(500) NULL,
ADD COLUMN city VARCHAR(100) NULL,
ADD COLUMN state VARCHAR(100) NULL,
ADD COLUMN country VARCHAR(100) NULL,
ADD COLUMN postal_code VARCHAR(20) NULL,
ADD COLUMN occupation VARCHAR(100) NULL,
ADD COLUMN education VARCHAR(200) NULL,
ADD COLUMN bio VARCHAR(500) NULL;

-- Update existing records to have default values
UPDATE users SET preferred_language = 'en' WHERE preferred_language IS NULL;
UPDATE users SET preferred_timezone = 'UTC' WHERE preferred_timezone IS NULL;

-- Add indexes for performance (optional but recommended)
CREATE INDEX idx_users_preferred_language ON users(preferred_language);
CREATE INDEX idx_users_preferred_currency ON users(preferred_currency);
CREATE INDEX idx_users_city ON users(city);
CREATE INDEX idx_users_country ON users(country);