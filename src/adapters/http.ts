import type { CallExpression } from 'ts-morph';
import type { BehaviorEvent } from '../types/index.js';
import { FrameworkAdapter, ASTContext, createLocation } from './types.js';

export class HttpAdapter implements FrameworkAdapter {
  readonly name = 'http';
  readonly order = 40;

  classifyCall(call: CallExpression, context: ASTContext): BehaviorEvent | null {
    const exprText = call.getExpression().getText();

    // 1. Native fetch: fetch(...)
    if (exprText === 'fetch' || exprText === 'globalThis.fetch' || exprText === 'window.fetch') {
      return {
        id: `http-fetch-${call.getStart()}`,
        type: 'HTTP_CALL',
        label: 'fetch',
        location: createLocation(context.filePath, call),
        isAwaited: context.isAwaited,
        isConditional: context.isConditional,
        isGuardedByTryCatch: context.isGuardedByTryCatch,
        adapterSource: this.name,
        rawCallee: exprText,
      };
    }

    // 2. Axios: axios(...), axios.get(...), axios.post(...)
    if (
      exprText === 'axios' ||
      exprText.startsWith('axios.') ||
      exprText.match(/(?:this\.)?axios(?:Instance)?\./)
    ) {
      return {
        id: `http-axios-${call.getStart()}`,
        type: 'HTTP_CALL',
        label: exprText,
        location: createLocation(context.filePath, call),
        isAwaited: context.isAwaited,
        isConditional: context.isConditional,
        isGuardedByTryCatch: context.isGuardedByTryCatch,
        adapterSource: this.name,
        rawCallee: exprText,
      };
    }

    // 3. NestJS HttpService: this.httpService.get(...), this.http.post(...)
    const match = exprText.match(/(?:this\.)?(?:httpService|httpClient|http)\.([a-zA-Z0-9_]+)$/i);
    if (match) {
      const [, method] = match;
      const lower = method.toLowerCase();
      if (['get', 'post', 'put', 'patch', 'delete', 'request', 'axiosref'].includes(lower)) {
        return {
          id: `http-service-${call.getStart()}`,
          type: 'HTTP_CALL',
          label: exprText,
          location: createLocation(context.filePath, call),
          isAwaited: context.isAwaited,
          isConditional: context.isConditional,
          isGuardedByTryCatch: context.isGuardedByTryCatch,
          adapterSource: this.name,
          rawCallee: exprText,
        };
      }
    }

    return null;
  }
}
