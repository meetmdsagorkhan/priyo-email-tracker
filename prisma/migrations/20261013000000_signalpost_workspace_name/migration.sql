UPDATE "Workspace"
SET "name" = 'Signalpost Workspace',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'legacy-priyo-workspace'
  AND "name" = 'Priyo Workspace';
