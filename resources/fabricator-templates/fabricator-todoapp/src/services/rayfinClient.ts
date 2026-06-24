import { RayfinClient } from '@microsoft/rayfin-client';

import type { TodoAppSchema } from '../../rayfin/data/schema';

export interface RayfinClientConfig {
  baseUrl: string;
  publishableKey: string;
}

let client: RayfinClient<TodoAppSchema> | null = null;

export function initRayfinClient(
  config: RayfinClientConfig
): RayfinClient<TodoAppSchema> {
  if (client) {
    throw new Error('Rayfin client is already initialized.');
  }
  client = new RayfinClient<TodoAppSchema>({
    baseUrl: config.baseUrl,
    publishableKey: config.publishableKey,
    useProxy: false,
    authStorage: true,
  });
  return client;
}

export function getRayfinClient(): RayfinClient<TodoAppSchema> {
  if (!client) {
    throw new Error(
      'Rayfin client not initialized. Call bootstrapAuth() first.'
    );
  }
  return client;
}
