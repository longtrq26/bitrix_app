export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  member_id: string;
  client_endpoint: string;
}
