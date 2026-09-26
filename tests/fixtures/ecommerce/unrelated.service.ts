export class UnrelatedService {
  constructor(private prisma: any) {}

  async healthCheck() {
    return await this.prisma.system.findFirst();
  }

  async getOrder(id: string) {
    return await this.prisma.order.findUnique({ where: { id } });
  }

  async resetPassword(email: string) {
    return true;
  }
}
