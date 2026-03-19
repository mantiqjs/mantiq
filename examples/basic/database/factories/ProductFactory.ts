import { Factory } from '@mantiq/database'
import type { Faker } from '@mantiq/database'
import { Product } from '@app/Models/Product.ts'

export class ProductFactory extends Factory<Product> {
  protected override model = Product

  override definition(index: number, fake: Faker) {
    return {
      name: fake.name(),
    }
  }
}
