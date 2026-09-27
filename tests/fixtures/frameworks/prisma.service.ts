export class PrismaUserService {
  constructor(private readonly prisma: any) {}

  async findUser(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async updateUser(id: string, data: unknown) {
    return this.prisma.user.update({ where: { id }, data });
  }
}
