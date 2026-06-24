import { RayfinClient } from '@microsoft/rayfin-client';

import type { DataAppSchema } from '../../rayfin/data/schema';

export interface RayfinClientConfig {
  baseUrl: string;
  publishableKey: string;
}

let client: RayfinClient<DataAppSchema> | null = null;

export function initRayfinClient(
  config: RayfinClientConfig
): RayfinClient<DataAppSchema> {
  if (client) {
    throw new Error('Rayfin client is already initialized.');
  }
  client = new RayfinClient<DataAppSchema>({
    baseUrl: config.baseUrl,
    publishableKey: config.publishableKey,
    useProxy: false,
    authStorage: true,
  });
  return client;
}

export function getRayfinClient(): RayfinClient<DataAppSchema> {
  if (!client) {
    throw new Error(
      'Rayfin client not initialized. Call bootstrapAuth() first.'
    );
  }
  return client;
}
