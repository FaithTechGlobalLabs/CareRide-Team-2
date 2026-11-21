// The application's real migrations require PostGIS; this image is amd64-only.
export const POSTGRES_IMAGE = "postgis/postgis:18-3.6";
export const TEST_DATABASE_NAME = "careride_test";
