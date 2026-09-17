import { createHash } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { AuthRepository } from './auth.repository.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '30d';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 10;
const GENERIC_LOGIN_ERROR = 'Email ou senha inválidos';
const INVALID_SESSION_ERROR = 'Sessão inválida, faça login novamente';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AccessTokenPayload {
  sub: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<TokenPair> {
    const existing = await this.authRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email já cadastrado');
    }

    const passwordHash = await hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.authRepository.create({
      email: dto.email,
      passwordHash,
    });

    return this.issueTokens(user.id);
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.authRepository.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const passwordMatches = await compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    return this.issueTokens(user.id);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = this.verifyRefreshToken(refreshToken);
    const user = await this.authRepository.findById(payload.sub);

    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException(INVALID_SESSION_ERROR);
    }

    const presentedHash = this.hashRefreshToken(refreshToken);
    if (presentedHash !== user.refreshTokenHash) {
      await this.authRepository.updateRefreshTokenHash(user.id, null, null);
      throw new UnauthorizedException(INVALID_SESSION_ERROR);
    }

    return this.issueTokens(user.id);
  }

  async logout(userId: string): Promise<void> {
    await this.authRepository.updateRefreshTokenHash(userId, null, null);
  }

  private async issueTokens(userId: string): Promise<TokenPair> {
    const payload: AccessTokenPayload = { sub: userId };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: ACCESS_TOKEN_TTL,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: REFRESH_TOKEN_TTL,
    });

    const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await this.authRepository.updateRefreshTokenHash(
      userId,
      this.hashRefreshToken(refreshToken),
      refreshTokenExpiresAt,
    );

    return { accessToken, refreshToken };
  }

  private verifyRefreshToken(refreshToken: string): AccessTokenPayload {
    try {
      return this.jwtService.verify<AccessTokenPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(INVALID_SESSION_ERROR);
    }
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }
}
