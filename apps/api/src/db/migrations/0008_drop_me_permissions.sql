-- The `me` resource was removed from RESOURCE_DEFINITIONS: profile routes only
-- need a session. Leftover grants would make PUT /roles/:id/permissions reject
-- the role (unknown permission) the next time its permissions are saved.
DELETE FROM "role_permissions" WHERE "resource" = 'me';
