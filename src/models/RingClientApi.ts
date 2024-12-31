import { RingApi } from "ring-client-api";
import { promisify } from "util";
import { readFile, writeFile } from "fs";

/**
 * Wrapper for the RingClientApi, to automatically refresh the ring-refresh-token without having the user manually do it.
 */
export class RingClientApi {
  private REFRESH_TOKEN = process.env.RING_REFRESH_TOKEN;
  private client: RingApi;

  constructor() {
    this.initialiseRingClient();
    this.refreshToken();
  }

  public getClient(): RingApi {
    return this.client;
  }

  /**
   * Initialise A ring API client using the config
   */
  private initialiseRingClient() {
    this.client = new RingApi({
      refreshToken: this.REFRESH_TOKEN,
      cameraStatusPollingSeconds: 2,
    });
  }

  private refreshToken() {
    this.client.onRefreshTokenUpdated.subscribe(
      async ({ newRefreshToken, oldRefreshToken }) => {
        if (!oldRefreshToken) {
          return;
        }
        // Update env config
        const currentConfig = await promisify(readFile)(".env"),
          updatedConfig = currentConfig
            .toString()
            .replace(oldRefreshToken, newRefreshToken);
        await promisify(writeFile)(".env", updatedConfig);

        this.REFRESH_TOKEN = newRefreshToken;

        // Reinitialise using new refresh token
        this.initialiseRingClient();
      }
    );
  }
}
