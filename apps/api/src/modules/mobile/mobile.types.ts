export type DevicePlatform = 'ios' | 'android';

export interface Device {
  id: string;
  userId: string;
  platform: DevicePlatform;
  pushToken: string;
  lastSeenAt: string;
}

export interface UploadRecord {
  id: string;
  uploadedBy: string;
  storageKey: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}
