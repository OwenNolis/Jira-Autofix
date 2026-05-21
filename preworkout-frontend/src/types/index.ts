export interface Product {
  id: number;
  categoryId: number;
  name: string;
  description: string;
  price: number;
  flavor: string;
  caffeineMg: number;
  servings: number;
  imageUrl: string;
  isActive: boolean;
}
