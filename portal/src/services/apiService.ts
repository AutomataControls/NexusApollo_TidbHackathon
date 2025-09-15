import { AuthService } from './authService';

class ApiServiceClass {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || '';
  }

  private async request(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...AuthService.getAuthHeader()
    };

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
        // Token expired or invalid
        AuthService.logout();
        window.location.href = '/login';
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }

      return response;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // GET request
  async get(endpoint: string): Promise<any> {
    return this.request(endpoint, {
      method: 'GET'
    });
  }

  // POST request
  async post(endpoint: string, data?: any): Promise<any> {
    return this.request(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  // PUT request
  async put(endpoint: string, data?: any): Promise<any> {
    return this.request(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  // DELETE request
  async delete(endpoint: string): Promise<any> {
    return this.request(endpoint, {
      method: 'DELETE'
    });
  }

  // File upload
  async upload(endpoint: string, file: File, additionalData?: any): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (additionalData) {
      Object.keys(additionalData).forEach(key => {
        formData.append(key, additionalData[key]);
      });
    }

    return this.request(endpoint, {
      method: 'POST',
      body: formData,
      headers: {
        ...AuthService.getAuthHeader()
        // Don't set Content-Type for FormData
      }
    });
  }

  // Download file
  async download(endpoint: string): Promise<Blob> {
    const response = await this.request(endpoint, {
      method: 'GET'
    });
    return response.blob();
  }
}

export const ApiService = new ApiServiceClass();