import { Product } from '../types';

export const mockProducts: Product[] = [
  {
    id: 1,
    name: 'Nitro Peach',
    description:
      'Intense pre-workout formule met 250mg caffeine voor maximale energie en focus. Ideaal voor krachtrainers die een explosieve boost nodig hebben. Gecombineerd met Beta-Alanine en L-Citrulline voor optimale pompwerking.',
    price: 34.99,
    flavor: 'Peach',
    caffeineMg: 250,
    servings: 30,
    stock: 42,
    imageUrl: 'https://placehold.co/400x400/00BFA5/FFFFFF?text=Nitro+Peach',
    isActive: true,
    category: 'Pre-Workout',
  },
  {
    id: 2,
    name: 'Mango Rush',
    description:
      'Geavanceerde pre-workout met Creatine blend en 300mg caffeine. Mango smaak met tropical twist. Bevat Creatine Monohydrate voor krachtontwikkeling en HMB voor spierbehoud tijdens intensieve sessies.',
    price: 39.99,
    flavor: 'Mango',
    caffeineMg: 300,
    servings: 25,
    stock: 18,
    imageUrl: 'https://placehold.co/400x400/FF6B35/FFFFFF?text=Mango+Rush',
    isActive: true,
    category: 'Pre-Workout',
  },
  {
    id: 3,
    name: 'Blue Ice',
    description:
      'Stimulant-arme pump formule met L-Citrulline Malate en Glycerol. Perfect voor avondtrainingen of cafeïne-gevoelige atleten. Geeft een intense vasculaire pump zonder caffeine jitters.',
    price: 32.99,
    flavor: 'Blueberry',
    caffeineMg: 80,
    servings: 30,
    stock: 5,
    imageUrl: 'https://placehold.co/400x400/1A237E/FFFFFF?text=Blue+Ice',
    isActive: true,
    category: 'Pump Formula',
  },
  {
    id: 4,
    name: 'Cherry Bomb',
    description:
      'Explosieve pre-workout met 350mg caffeine en Nootropics voor mentale scherpte. Kersen smaak. Bevat Alpha-GPC en Huperzine-A voor cognitieve focus tijdens zware trainingssessies.',
    price: 44.99,
    flavor: 'Cherry',
    caffeineMg: 350,
    servings: 20,
    stock: 0,
    imageUrl: 'https://placehold.co/400x400/C62828/FFFFFF?text=Cherry+Bomb',
    isActive: true,
    category: 'Pre-Workout',
  },
  {
    id: 5,
    name: 'Watermelon Wave',
    description:
      'Hydraterende pre-workout met Elektrolyten en 200mg caffeine. Watermeloen smaak voor verfrissende energie. Bevat Coconut Water Powder en Sea Salt voor optimale hydratatie tijdens intensieve workouts.',
    price: 36.99,
    flavor: 'Watermelon',
    caffeineMg: 200,
    servings: 30,
    stock: 3,
    imageUrl: 'https://placehold.co/400x400/26A69A/FFFFFF?text=Watermelon+Wave',
    isActive: true,
    category: 'Hydration',
  },
  {
    id: 6,
    name: 'Lemon Storm',
    description:
      'Zuivere energie pre-workout met 275mg caffeine en Taurine. Citroensmaak met frisse kick. Gecombineerd met Vitamin B-complex voor optimale energie metabolisme en vermindering van vermoeidheid.',
    price: 33.99,
    flavor: 'Lemon',
    caffeineMg: 275,
    servings: 30,
    stock: 27,
    imageUrl: 'https://placehold.co/400x400/F9A825/FFFFFF?text=Lemon+Storm',
    isActive: true,
    category: 'Pre-Workout',
  },
];

export const flavors = ['Peach', 'Mango', 'Blueberry', 'Cherry', 'Watermelon', 'Lemon'];

export const categories = ['Pre-Workout', 'Pump Formula', 'Hydration'];
