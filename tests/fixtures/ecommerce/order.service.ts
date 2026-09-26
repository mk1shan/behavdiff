export class OrderService {
  constructor(private prisma: any, private mailService: any) {}

  async createOrder(data: any) {
    this.validateOrder(data);
    await this.prisma.order.create({ data });
    await this.mailService.sendConfirmation(data.email);
  }

  private validateOrder(data: any) {
    if (!data.items || data.items.length === 0) {
      throw new Error('Order items required');
    }
  }
}
