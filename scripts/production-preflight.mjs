const isCloudRun = Boolean(
  process.env.K_SERVICE || process.env.K_REVISION || process.env.K_CONFIGURATION
);

const backend = String(process.env.MV_DATA_BACKEND || 'sqlite').trim().toLowerCase();

if (backend !== 'sqlite') {
  console.error(
    `[MV Storage] Refusing startup: MV_DATA_BACKEND='${backend}' is not implemented by this build.`
  );
  process.exit(78);
}

if (isCloudRun) {
  console.error(
    '[MV Storage] Refusing Cloud Run startup with SQLite. ' +
      'The Cloud Run container filesystem is not an approved durable authoritative datastore for MV household finances. ' +
      'Deploy only after a shared persistent production datastore is implemented and selected.'
  );
  process.exit(78);
}
