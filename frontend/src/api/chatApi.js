import api from '../services/Url.service';

const fail = (error, fallback) => {
  throw new Error(error?.response?.data?.message || error?.message || fallback);
};

export async function getConversations() {
  try {
    return (await api.get('/chat/conversations')).data.data || [];
  } catch (error) {
    return fail(error, 'Unable to load conversations');
  }
}

export async function getMessages(conversationId) {
  try {
    return (await api.get(`/chat/conversations/${conversationId}/messages`)).data.data || [];
  } catch (error) {
    return fail(error, 'Unable to load messages');
  }
}

export async function sendMessage(receiverId, content = '', mediaFile = null) {
  try {
    // Plain text should be JSON. This avoids multipart boundary/body parsing
    // problems and makes receiverId/content reliably available in Express.
    if (!mediaFile) {
      const payload = {
        receiverId: String(receiverId || ''),
        content: String(content || '').trim(),
      };
      return (await api.post('/chat/send-message', payload)).data.data;
    }

    // Use multipart only when there is an actual file. Do NOT manually set
    // Content-Type; Axios/browser must add the required boundary parameter.
    const form = new FormData();
    form.append('receiverId', String(receiverId || ''));
    if (String(content || '').trim()) form.append('content', String(content).trim());
    form.append('media', mediaFile);

    return (await api.post('/chat/send-message', form)).data.data;
  } catch (error) {
    return fail(error, 'Unable to send message');
  }
}

export async function reactToMessage(messageId, emoji) {
  try {
    return (await api.put(`/chat/messages/${messageId}/reaction`, { emoji })).data.data;
  } catch (error) {
    return fail(error, 'Unable to react');
  }
}

export async function deleteMessage(messageId) {
  try {
    return (await api.delete(`/chat/messages/${messageId}`)).data;
  } catch (error) {
    return fail(error, 'Unable to delete message');
  }
}
