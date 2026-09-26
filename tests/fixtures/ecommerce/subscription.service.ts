export class SubscriptionService {
  constructor(private prisma: any, private mailService: any) {}

  async createSubscription(data: any) {
    await this.mailService.sendConfirmation(data.email);
    await this.prisma.subscription.create({ data });
  }
}
