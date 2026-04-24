## Signature Examples

```typescript
// Service method
async deactivateUser(id: string): Promise<UserResponseDto> { ... }

// Guard
canActivate(context: ExecutionContext): boolean | Promise<boolean> { ... }

// Pipe
transform(value: unknown, metadata: ArgumentMetadata): CreateUserDto { ... }
```

## Validation Libraries

- **class-validator + class-transformer** — standard for NestJS DTOs. Decorate DTO properties with `@IsString()`, `@IsEmail()`, `@Min()`, etc. Apply via `ValidationPipe`.
- **Zod** (with `nestjs-zod`) — alternative for teams preferring schema-first validation. Define schemas, infer types, use `ZodValidationPipe`.
- Always validate at the controller boundary (incoming DTOs). Services trust their inputs.
