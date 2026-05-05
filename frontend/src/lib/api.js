import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// Contributions

export function uploadContribution(slug, formData, storyToken, onProgress) {
  return axios.post(`/api/public/${slug}/contributions`, formData, {
    headers: {
      'x-story-token': storyToken,
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: onProgress,
  });
}

export function listContributions(storyId, status) {
  const params = status ? { status } : {};
  return api.get(`/api/stories/${storyId}/contributions`, { params });
}

export function updateContribution(storyId, id, status) {
  return api.patch(`/api/stories/${storyId}/contributions/${id}`, { status });
}

export function deleteContribution(storyId, id) {
  return api.delete(`/api/stories/${storyId}/contributions/${id}`);
}
