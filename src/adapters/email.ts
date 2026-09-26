import type { CallExpression } from 'ts-morph';
import type { BehaviorEvent } from '../types/index.js';
import { FrameworkAdapter, ASTContext, createLocation } from './types.js';

export class EmailAdapter implements FrameworkAdapter {
  readonly name = 'email';
  readonly order = 30;

  classifyCall(call: CallExpression, context: ASTContext): BehaviorEvent | null {
    const exprText = call.getExpression().getText();

    // 1. Direct function names: sendEmail(...), sendMail(...)
    if (exprText === 'sendEmail' || exprText === 'sendMail') {
      return {
        id: `email-fn-${call.getStart()}`,
        type: 'EMAIL',
        label: exprText,
        location: createLocation(context.filePath, call),
        isAwaited: context.isAwaited,
        isConditional: context.isConditional,
        isGuardedByTryCatch: context.isGuardedByTryCatch,
        adapterSource: this.name,
        rawCallee: exprText,
      };
    }

    // 2. Transporter / Mailer / MailService calls:
    // this.mailService.send(...), transporter.sendMail(...), mailer.sendMail(...), this.emailService.send(...)
    const match = exprText.match(
      /(?:this\.)?([a-zA-Z0-9_]*(?:mail|email)[a-zA-Z0-9_]*|transporter|resend|sgMail)\.([a-zA-Z0-9_]+)$/i,
    );
    if (match) {
      const [, service, method] = match;
      const lowerMethod = method.toLowerCase();
      if (
        lowerMethod.includes('send') ||
        lowerMethod.includes('notify') ||
        lowerMethod.includes('dispatch')
      ) {
        return {
          id: `email-service-${call.getStart()}`,
          type: 'EMAIL',
          label: `${service}.${method}`,
          location: createLocation(context.filePath, call),
          isAwaited: context.isAwaited,
          isConditional: context.isConditional,
          isGuardedByTryCatch: context.isGuardedByTryCatch,
          adapterSource: this.name,
          rawCallee: exprText,
        };
      }
    }

    // 3. Any injected dependency with 'mail' or 'email' calling a send-like method
    const isEmailDep = context.injectedDependencies.some(
      (dep) => dep.toLowerCase().includes('mail') || dep.toLowerCase().includes('email'),
    );
    if (isEmailDep && (exprText.includes('.send') || exprText.includes('.sendMail'))) {
      return {
        id: `email-dep-${call.getStart()}`,
        type: 'EMAIL',
        label: exprText,
        location: createLocation(context.filePath, call),
        isAwaited: context.isAwaited,
        isConditional: context.isConditional,
        isGuardedByTryCatch: context.isGuardedByTryCatch,
        adapterSource: this.name,
        rawCallee: exprText,
      };
    }

    return null;
  }
}
