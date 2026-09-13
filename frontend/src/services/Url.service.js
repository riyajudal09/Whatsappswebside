import axios from 'axios';

const apiUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api`;

const axiosInstance = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  // Render Free can take about a minute to wake after being idle.
  timeout: 75000,
});

export default axiosInstance;
