// import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
// import { Observable } from "rxjs";

// @Injectable()
// export class LoggingInterceptor implements NestInterceptor{
//   private readonly logger = new Logger('HTTP');

//   intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
//     const ctx = context.switchToHttp();
//     const req = ctx.getRequest<Request>();
//     const res = ctx.getResponse<Response>();


//   }
// }