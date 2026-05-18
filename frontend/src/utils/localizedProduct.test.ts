import type { Product } from '../types';
import { localizeProduct } from './localizedProduct';

const baseProduct: Product = {
  id: 8,
  name: 'CanineCore Puppy Training Treats',
  description: 'Soft bite-size chicken treats for puppy training.',
  price: 12.9,
  stock: 160,
  categoryId: 8,
  imageUrl: 'https://example.com/treats.jpg',
};

describe('localizeProduct', () => {
  it('uses Spanish fallback names for demo catalog products', () => {
    expect(localizeProduct(baseProduct, 'es').name).toBe(
      'Premios CanineCore para entrenamiento de cachorro',
    );
  });

  it('prefers backend i18n fields over fallback text', () => {
    const product = {
      ...baseProduct,
      specifications: {
        'i18n.es.name': 'Premios personalizados',
      },
    };

    expect(localizeProduct(product, 'es').name).toBe('Premios personalizados');
  });

  it('polishes common Spanish demo text from backend i18n fields', () => {
    const product = {
      ...baseProduct,
      name: 'NutriTail Grain-Free Salmon Cat Food 2kg',
      specifications: {
        'i18n.es.name': 'Alimento NutriTail de salmon sin granos para gato, 2 kg',
      },
    };

    expect(localizeProduct(product, 'es').name).toBe(
      'Alimento NutriTail de salmón sin granos para gato, 2 kg',
    );
  });

  it('keeps the original product name outside Spanish', () => {
    expect(localizeProduct(baseProduct, 'en').name).toBe('CanineCore Puppy Training Treats');
  });
});
