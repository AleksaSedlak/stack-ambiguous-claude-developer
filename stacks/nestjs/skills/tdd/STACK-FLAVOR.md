## Signature Examples

### Service Method

```typescript
// Start with the typed signature — no implementation yet
async createUser(dto: CreateUserDto): Promise<User> {
  throw new Error('Not implemented');
}
```

### Guard canActivate

```typescript
import { CanActivate, ExecutionContext } from '@nestjs/common';

canActivate(context: ExecutionContext): boolean | Promise<boolean> {
  throw new Error('Not implemented');
}
```

### Pipe transform

```typescript
import { PipeTransform, ArgumentMetadata } from '@nestjs/common';

transform(value: unknown, metadata: ArgumentMetadata): number {
  throw new Error('Not implemented');
}
```

## Validation Libraries

- **class-validator + class-transformer** (standard NestJS approach) — decorate DTO classes with validation decorators (`@IsEmail()`, `@IsNotEmpty()`, `@MinLength()`), enable with `ValidationPipe`. This is the idiomatic NestJS pattern.

```typescript
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(2)
  name: string;
}
```

- **Zod + nestjs-zod** (alternative) — define schemas with Zod, use `createZodDto()` to generate DTOs that work with NestJS pipes. Preferred when you want schema-first validation or shared schemas between frontend and backend.

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
});

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
```
