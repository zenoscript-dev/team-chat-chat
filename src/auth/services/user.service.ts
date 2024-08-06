import { Injectable } from '@nestjs/common';
import { JwtService } from './jwt.service';
import { v4 as uuidv4 } from 'uuid'; // Import UUID v4

@Injectable()
export class UserService {
  private readonly users = [
    {
      id: uuidv4(), // Generate a valid UUID
      username: 'user1',
      password: 'password1',
      roles: ['user'],
    },
    {
      id: uuidv4(), // Generate a valid UUID
      username: 'user2',
      password: 'password2',
      roles: ['admin'],
    },
  ];

  constructor(private readonly jwtService: JwtService) {}

  authenticate(username: string, password: string) {
    const user = this.users.find(
      (u) => u.username === username && u.password === password,
    );
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const payload = {
      id: user.id,
      roles: user.roles,
      expiresIn: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
    };

    const token = this.jwtService.generateToken(payload);

    return { token, ...payload };
  }
}
