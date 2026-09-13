import api from '../services/Url.service';

const unwrapError = (error, fallback) => {
  throw new Error(error?.response?.data?.message || error?.message || fallback);
};

export async function registerUser(payload) {
  try { return (await api.post('/auth/register', payload)).data; }
  catch (error) { return unwrapError(error, 'Unable to create account'); }
}

export async function loginUser(payload) {
  try { return (await api.post('/auth/login', payload)).data; }
  catch (error) { return unwrapError(error, 'Unable to login'); }
}

export async function updateUserProfile(formData) {
  try {
    const { data } = await api.put('/auth/update-profile', formData);
    return data;
  } catch (error) { return unwrapError(error, 'Unable to update profile'); }
}

export async function checkUserAuth() {
  try {
    const { data } = await api.get('/auth/check-auth');
    const session = data?.data;
    return { isAuthenticated: Boolean(session?.authenticated), user: session?.user || null };
  } catch (_) { return { isAuthenticated: false, user: null }; }
}

export async function logoutUser() {
  try { return (await api.get('/auth/logout')).data; }
  catch (error) { return unwrapError(error, 'Unable to logout'); }
}

export async function getAllUser() {
  try { return (await api.get('/auth/user')).data; }
  catch (error) { return unwrapError(error, 'Unable to load users'); }
}
