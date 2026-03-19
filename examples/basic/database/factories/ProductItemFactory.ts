import { Factory } from '@mantiq/database'
import type { Faker } from '@mantiq/database'
import { ProductItem } from '../../app/Models/ProductItem.ts'

export class ProductItemFactory extends Factory<ProductItem> {
  protected override model = ProductItem

  override definition(index: number, fake: Faker) {
    return {
      name: fake.name(),
    }
  }
}
