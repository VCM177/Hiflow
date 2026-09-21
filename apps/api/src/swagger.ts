import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { PUBLIC_EXTENSION } from './common/decorators/public.decorator';
import { SESSION_COOKIE } from './modules/auth/session-cookie';

const DESCRIPTION = `API quản lý tuyển dụng Hiflow.

Mã lỗi chung mà giao diện cần xử lý:
- **401** chưa đăng nhập hoặc phiên đã hết hạn (đưa về trang đăng nhập).
- **403** vai trò hiện tại không có quyền thực hiện thao tác.
- **404** không tồn tại, hoặc nằm ngoài phạm vi dữ liệu của người dùng (không phân biệt hai trường hợp).
- **409** xung đột trạng thái, người khác vừa thao tác trước.
- **429** quá nhiều yêu cầu, đợi theo header \`Retry-After\` (giây).`;

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/** Every operation that is not public can answer 401, so say so once, here. */
export function documentUnauthorized(document: OpenAPIObject): void {
  for (const pathItem of Object.values(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];

      if (operation && !(PUBLIC_EXTENSION in operation)) {
        operation.responses['401'] ??= {
          description: 'Chưa đăng nhập hoặc phiên đã hết hạn',
        };
      }
    }
  }
}

/** The OpenAPI document served at /docs, and the contract the web app is built from. */
export function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle('Hiflow API')
    .setDescription(DESCRIPTION)
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth(SESSION_COOKIE)
    .addServer('http://localhost:4000', 'Local development')
    .addServer('/api', "Through the web app's /api proxy (same origin)");

  const productionUrl = app.get(ConfigService).get<string>('PUBLIC_API_URL');
  if (productionUrl) {
    builder.addServer(productionUrl, 'Production (Cloud Run)');
  }

  const document = SwaggerModule.createDocument(app, builder.build());
  documentUnauthorized(document);

  return document;
}
