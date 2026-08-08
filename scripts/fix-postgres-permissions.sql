-- Fix P1010 "User was denied access" for existing digitix_hrms database
-- Run as postgres superuser in pgAdmin Query Tool or SQL Shell

ALTER USER hrms WITH PASSWORD 'hrms_password' LOGIN;

ALTER DATABASE digitix_hrms OWNER TO hrms;
GRANT ALL PRIVILEGES ON DATABASE digitix_hrms TO hrms;
GRANT CONNECT ON DATABASE digitix_hrms TO hrms;

\c digitix_hrms

ALTER SCHEMA public OWNER TO hrms;
GRANT ALL ON SCHEMA public TO hrms;
GRANT CREATE ON SCHEMA public TO hrms;
GRANT USAGE ON SCHEMA public TO hrms;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO hrms;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO hrms;
