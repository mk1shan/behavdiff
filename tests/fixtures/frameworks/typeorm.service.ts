import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

declare class UserEntity {}

export class TypeOrmUserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async findUser(id: number) {
    return this.userRepository.findOne(id);
  }

  async updateUser(user: UserEntity) {
    return this.userRepository.save(user);
  }
}
