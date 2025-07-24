export class RedisKeys {
  static session(token: string): string {
    return `session:${token}`;
  }

  static sessionSet(memberId: string): string {
    return `session_set:${memberId}`;
  }

  static state(domain: string): string {
    return `state:${domain}`;
  }

  static token(memberId: string): string {
    return `token:${memberId}`;
  }
}
