export const RedisKeys = {
  token: (memberId: string) => `bitrix24:token:${memberId}`,
  session: (token: string) => `bitrix24:session:${token}`,
  state: (domain: string) => `bitrix24:state:${domain}`,
};
