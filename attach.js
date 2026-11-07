// ============================================================
// MIRACARDIAC CHAT - attachment uploader (photos, voice notes, files)
// Tries, in order:
//   1) Cloudinary   (only if CLOUD NAME + PRESET are set in js/config.js)
//   2) Firebase Storage  (path: consultations/<chatId>/..., allowed by storage.rules)
//   3) Inline in the message itself (compressed photo / short voice note)
// so a photo or voice note ALWAYS goes through, even before Cloudinary or
// Storage are set up. Returns a URL string (https://... or data:...).
// ============================================================
import {
  storage, ref, uploadBytesResumable, getDownloadURL,
  uploadToCloudinary, CLOUDINARY_CLOUD_NAME
} from './config.js';

const withTimeout = (p, ms, label) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error(label + ' timed out')), ms);
  p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); });
});

function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error || new Error('Could not read file'));
    r.readAsDataURL(blob);
  });
}

// Re-draw a photo smaller as JPEG (phone photos are 3-8 MB; chat needs ~200 KB)
async function shrinkImage(file, maxSide, quality) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Could not read this image'));
      i.src = url;
    });
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', quality));
    if (!blob) throw new Error('Image compression failed');
    return blob;
  } finally { URL.revokeObjectURL(url); }
}

function storageUpload(body, chatId, name, contentType) {
  const r = ref(storage, 'consultations/' + chatId + '/' + Date.now() + '_' + name);
  const task = uploadBytesResumable(r, body, { contentType });
  return new Promise((res, rej) => {
    const t = setTimeout(() => { try { task.cancel(); } catch (_) {} rej(new Error('Storage timed out')); }, 20000);
    task.on('state_changed', null,
      e => { clearTimeout(t); rej(e); },
      async () => { clearTimeout(t); try { res(await getDownloadURL(r)); } catch (e) { rej(e); } });
  });
}

export async function uploadAttachment(file, chatId) {
  const type = file.type || '';
  const isImg = type.startsWith('image/') && type !== 'image/gif';
  const isAudio = type.startsWith('audio/');
  const errors = [];

  // Smaller upload for photos on mobile data
  let body = file, ctype = type || 'application/octet-stream';
  let name = (file.name || 'file').replace(/[^\w.\-]+/g, '_');
  if (isImg) {
    try {
      body = await shrinkImage(file, 1600, 0.82);
      ctype = 'image/jpeg';
      name = name.replace(/\.\w+$/, '') + '.jpg';
    } catch (e) { errors.push(e); }
  }

  // 1) Cloudinary
  const cloudOk = CLOUDINARY_CLOUD_NAME && CLOUDINARY_CLOUD_NAME !== 'YOUR_CLOUD_NAME';
  if (cloudOk) {
    try { return await withTimeout(uploadToCloudinary(body, 'chats/' + chatId), 45000, 'Cloudinary'); }
    catch (e) { errors.push(e); }
  }

  // 2) Firebase Storage
  try { return await storageUpload(body, chatId, name, ctype); }
  catch (e) { errors.push(e); }

  // 3) Inline (stays well under Firestore's 1 MB document limit)
  try {
    if (isImg) {
      let b = await shrinkImage(file, 960, 0.7);
      if (b.size > 230 * 1024) b = await shrinkImage(file, 640, 0.6);
      return await blobToDataURL(b);
    }
    if (isAudio && file.size <= 600 * 1024) return await blobToDataURL(file);
    if (!isAudio && file.size <= 300 * 1024) return await blobToDataURL(file);
  } catch (e) { errors.push(e); }

  const why = errors.map(e => e.code || e.message).filter(Boolean).join(' | ');
  throw new Error(isAudio ? 'Voice note too long to send right now (' + why + ')'
                          : 'File too large to send right now (' + why + ')');
}
