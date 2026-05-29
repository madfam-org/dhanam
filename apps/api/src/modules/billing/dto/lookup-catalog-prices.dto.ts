import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString, IsUUID } from 'class-validator';

export class LookupCatalogPricesDto {
  @ApiProperty({
    description: 'ProductPrice row ids returned from apply-price',
    type: [String],
    maxItems: 200,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @IsUUID('4', { each: true })
  ids!: string[];
}
