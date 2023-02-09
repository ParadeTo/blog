---
title: Nest.js 微服务实战之用户认证（基于 GraphQL 和 RPC）
date: 2023-01-29 16:51:23
tags:
---

# 前言

上文[]()已经搭建好了 Nest.js 微服务系统框架，这一篇我们来做用户认证。流程大致如下：

# 补充

## Strategy 是怎么注册的

```ts
// auth.module.ts
@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: {expiresIn: '60s'},
    }),
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy], // 这里面的会自动初始化
  exports: [AuthService],
})
export class AuthModule {}
```

```ts
// local.strategy.ts

import {PassportStrategy} from '@nestjs/passport'

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super()
  }

  async validate(username: string, password: string): Promise<any> {
    debugger
    const user = await this.authService.validateUser(username, password)
    if (!user) {
      throw new UnauthorizedException()
    }
    return user
  }
}
```

接下来看 `@nestjs/passport` 这个库：

```ts
// ./lib/password/passport.strategy.ts

export function PassportStrategy<T extends Type<any> = any>(
  Strategy: T,
  name?: string | undefined
): {
  new (...args): InstanceType<T>
} {
  // 关键在这里, 继承关系 MyStategy -> MixinStrategy -> JwtStrategy/LocalStrategy
  abstract class MixinStrategy extends Strategy {
    abstract validate(...args: any[]): any

    constructor(...args: any[]) {
      const callback = async (...params: any[]) => {
        const done = params[params.length - 1]
        try {
          const validateResult = await this.validate(...params)
          if (Array.isArray(validateResult)) {
            done(null, ...validateResult)
          } else {
            done(null, validateResult)
          }
        } catch (err) {
          done(err, null)
        }
      }
      /**
       * Commented out due to the regression it introduced
       * Read more here: https://github.com/nestjs/passport/issues/446

        const validate = new.target?.prototype?.validate;
        if (validate) {
          Object.defineProperty(callback, 'length', {
            value: validate.length + 1
          });
        }
      */
      super(...args, callback) // 这个 callback 会在 JwtStrategy/LocalStrategy 的 authenticate 中调用

      const passportInstance = this.getPassportInstance()
      if (name) {
        passportInstance.use(name, this as any) // 关键在这里
      } else {
        passportInstance.use(this as any)
      }
    }

    getPassportInstance() {
      return passport
    }
  }
  return MixinStrategy
}
```

然后看 `@nestjs/passport -> lib/auth.guard.ts`，最后调用了 `passport.authenticate(type...` 跟上面的联系起来了。
