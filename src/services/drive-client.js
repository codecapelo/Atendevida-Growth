import { google } from 'googleapis';
import { env, driveEnabled } from '#config/env.js';
import { logger } from '#lib/logger.js';

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

let driveClient = null;

function getClient() {
  if (!driveEnabled) {
    throw new Error('Google Drive não configurado');
  }
  if (driveClient) return driveClient;

  const sa = env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const jwt = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: SCOPES,
  });
  driveClient = google.drive({ version: 'v3', auth: jwt });
  return driveClient;
}

export async function listFiles({ folderId = env.GDRIVE_MEDIA_FOLDER_ID } = {}) {
  const drive = getClient();
  const q = `'${folderId}' in parents and trashed = false and (mimeType contains 'image/' or mimeType contains 'video/')`;
  const res = await drive.files.list({
    q,
    fields: 'files(id, name, mimeType, thumbnailLink, modifiedTime, size)',
    orderBy: 'modifiedTime desc',
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files ?? [];
}

export async function getFileMetadata(fileId) {
  const drive = getClient();
  const res = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, parents, size',
    supportsAllDrives: true,
  });
  return res.data;
}

export async function streamFile(fileId) {
  const drive = getClient();
  const meta = await getFileMetadata(fileId);

  const expectedFolder = env.GDRIVE_MEDIA_FOLDER_ID;
  if (!meta.parents || !meta.parents.includes(expectedFolder)) {
    logger.warn({ fileId, parents: meta.parents }, 'Tentativa de acesso fora da pasta configurada');
    const err = new Error('Arquivo fora da pasta autorizada');
    err.statusCode = 403;
    throw err;
  }

  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' },
  );
  return { stream: res.data, mimeType: meta.mimeType, size: meta.size };
}
