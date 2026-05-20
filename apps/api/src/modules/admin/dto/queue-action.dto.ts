import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsBoolean, IsString, MinLength } from 'class-validator';

export class QueueActionDto {
  @ApiProperty({ description: 'Name of the BullMQ queue to act on' })
  @IsString()
  @MinLength(1)
  queueName: string;
}

export class ClearQueueDto {
  @ApiProperty({
    description: 'Explicit server-side confirmation for destructive queue clearing',
    example: true,
  })
  @IsBoolean()
  @Equals(true)
  confirm: true;
}
