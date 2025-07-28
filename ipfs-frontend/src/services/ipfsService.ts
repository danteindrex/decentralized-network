import axios from 'axios';

export interface IPFSConfig {
  host: string;
  port: number;
}

export class IPFSService {
  private baseUrl: string;

  constructor(config: IPFSConfig) {
    this.baseUrl = `http://${config.host}:${config.port}/api/v0`;
  }

  async uploadText(content: string): Promise<string> {
    try {
      const formData = new FormData();
      const blob = new Blob([content], { type: 'text/plain' });
      formData.append('file', blob, 'content.txt');

      const response = await axios.post(`${this.baseUrl}/add`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      });

      return response.data.Hash;
    } catch (error) {
      console.error('IPFS upload failed:', error);
      throw new Error('Failed to upload content to IPFS');
    }
  }

  async uploadJSON(data: any): Promise<string> {
    try {
      const content = JSON.stringify(data, null, 2);
      return await this.uploadText(content);
    } catch (error) {
      console.error('IPFS JSON upload failed:', error);
      throw new Error('Failed to upload JSON to IPFS');
    }
  }

  async uploadFile(file: File): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${this.baseUrl}/add`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // Longer timeout for file uploads
      });

      return response.data.Hash;
    } catch (error) {
      console.error('IPFS file upload failed:', error);
      throw new Error('Failed to upload file to IPFS');
    }
  }

  async fetchContent(cid: string): Promise<string> {
    try {
      const response = await axios.post(`${this.baseUrl}/cat`, null, {
        params: { arg: cid },
        timeout: 30000,
      });

      return response.data;
    } catch (error) {
      console.error('IPFS fetch failed:', error);
      throw new Error('Failed to fetch content from IPFS');
    }
  }

  async fetchJSON(cid: string): Promise<any> {
    try {
      const content = await this.fetchContent(cid);
      return JSON.parse(content);
    } catch (error) {
      console.error('IPFS JSON fetch failed:', error);
      throw new Error('Failed to fetch and parse JSON from IPFS');
    }
  }

  async pinContent(cid: string): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/pin/add`, null, {
        params: { arg: cid },
        timeout: 30000,
      });
    } catch (error) {
      console.error('IPFS pin failed:', error);
      throw new Error('Failed to pin content');
    }
  }

  async unpinContent(cid: string): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/pin/rm`, null, {
        params: { arg: cid },
        timeout: 30000,
      });
    } catch (error) {
      console.error('IPFS unpin failed:', error);
      throw new Error('Failed to unpin content');
    }
  }

  async getStatus(): Promise<{ online: boolean; version?: string }> {
    try {
      const response = await axios.post(`${this.baseUrl}/version`, null, {
        timeout: 5000,
      });
      
      return {
        online: true,
        version: response.data.Version
      };
    } catch (error) {
      return { online: false };
    }
  }

  getGatewayUrl(cid: string): string {
    // Using local gateway by default
    return `http://${this.baseUrl.split('/')[2].split(':')[0]}:8080/ipfs/${cid}`;
  }
}
