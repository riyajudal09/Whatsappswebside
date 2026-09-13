import api from '../services/Url.service';

const fail = (error, fallback) => { throw new Error(error?.response?.data?.message || error?.message || fallback); };

export async function getStatuses() {
  try { return (await api.get('/status')).data.data || []; }
  catch (error) { return fail(error, 'Unable to load statuses'); }
}

export async function createStatus(content, mediaFile) {
  try {
    const form = new FormData();
    if (content) form.append('content', content);
    if (mediaFile) form.append('media', mediaFile);
    // Let Axios/browser set multipart Content-Type including its boundary.
    return (await api.post('/status', form)).data.data;
  } catch (error) { return fail(error, 'Unable to create status'); }
}

export async function markStatusViewed(statusId) {
  try { await api.put(`/status/${statusId}/view`); } catch (_) {}
}

export async function deleteStatus(statusId) {
  try { return (await api.delete(`/status/${statusId}`)).data; }
  catch (error) { return fail(error, 'Unable to delete status'); }
}
