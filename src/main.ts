import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle("ExampleHR Time-Off Microservice")
    .setDescription("REST API for managing employee time-off requests and HCM balance synchronization")
    .setVersion("1.0.0")
    .addTag("Balances", "Employee time-off balance queries")
    .addTag("Requests", "Time-off request lifecycle management")
    .addTag("Sync", "HCM balance synchronization")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Swagger UI: http://localhost:${process.env.PORT ?? 3000}/api/docs`);
}
bootstrap();
