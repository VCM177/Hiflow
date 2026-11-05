import { apiProxyConfigFromEnv, forwardToApi } from '@/server/api-proxy';

// Every method goes to the API unchanged; the API decides what is allowed.
async function handler(request: Request): Promise<Response> {
  const config = apiProxyConfigFromEnv();
  if (!config) {
    return Response.json(
      { statusCode: 500, message: 'Máy chủ chưa được cấu hình.' },
      { status: 500 },
    );
  }
  return forwardToApi(request, config);
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as HEAD,
  handler as OPTIONS,
};
