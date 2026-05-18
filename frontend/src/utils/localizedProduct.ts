import type { Product } from '../types';
import type { Language } from '../i18n';

type LocalizedProductField = 'name' | 'description' | 'brand';

const spanishProductFallbacks: Record<string, Partial<Record<LocalizedProductField, string>>> = {
  'PawPilot Smart Pet Feeder 4L': {
    name: 'Comedero inteligente PawPilot 4L',
    description: 'Comedero automático programable con control de porciones para gatos y perros pequeños.',
  },
  'HydraWhisk Quiet Cat Water Fountain': {
    name: 'Fuente silenciosa HydraWhisk para gato',
    description: 'Fuente filtrada de bajo ruido que ayuda a los gatos a beber mas agua.',
  },
  'TrailTails Walking Starter Bundle': {
    name: 'Kit TrailTails de paseo inicial',
    description: 'Correa, collar y bolsas en un kit para paseos diarios mas seguros.',
  },
  'CloudNap Orthopedic Calming Bed': {
    name: 'Cama ortopédica CloudNap relajante',
    description: 'Cama con bordes, espuma ortopédica y funda lavable para descanso diario.',
  },
  'BrightBite Dental Chew Toy Set': {
    name: 'Set BrightBite de juguetes dentales para morder',
    description: 'Par de juguetes resistentes con relieves para juego y cuidado dental diario.',
  },
  'PurePaws Oatmeal Sensitive Shampoo': {
    name: 'Champú PurePaws de avena para piel sensible',
    description: 'Champú suave de avena para perros y gatos con piel sensible.',
  },
  'NutriTail Grain-Free Salmon Cat Food 2kg': {
    name: 'Alimento NutriTail de salmón sin granos para gato, 2 kg',
    description: 'Alimento seco completo con salmón, taurina y minerales balanceados para gatos adultos.',
  },
  'CanineCore Puppy Training Treats': {
    name: 'Premios CanineCore para entrenamiento de cachorro',
    description: 'Premios suaves de pollo en bocados pequeños para entrenar cachorros.',
  },
  'NutriTail Adult Dog Salmon & Rice 5kg': {
    name: 'Alimento NutriTail de salmón y arroz para perro adulto, 5 kg',
    description: 'Alimento seco balanceado de salmón y arroz para perros adultos con estómago sensible.',
  },
  'CanineCore Puppy Chicken Bites 500g': {
    name: 'Bocaditos CanineCore de pollo para cachorro, 500 g',
    description: 'Premios suaves para cachorro en porciones pequenas, ideales para recompensas rapidas.',
  },
  'NutriTail Indoor Cat Hairball Control 3kg': {
    name: 'Alimento NutriTail para gato indoor control bolas de pelo, 3 kg',
    description: 'Alimento para gato de interior con fibra, taurina y calorias controladas.',
  },
  'HydraWhisk Tuna Creamy Cat Treats 24 Pack': {
    name: 'Premios cremosos HydraWhisk de atún para gato, 24 piezas',
    description: 'Premios cremosos de atún para consentir, complementar comida u ocultar suplementos.',
  },
  'PawPilot Smart Feeder Mini 2L': {
    name: 'Comedero inteligente PawPilot Mini 2L',
    description: 'Comedero automático compacto para gatos y perros pequeños con horarios desde la app.',
  },
  'PawPilot Dual Bowl Slow Feeder Station': {
    name: 'Estación PawPilot de doble plato con comedero lento',
    description: 'Estación elevada con platos de acero y accesorio para comer más lento.',
  },
  'HydraWhisk Ceramic Flow Fountain 2.8L': {
    name: 'Fuente cerámica HydraWhisk Flow 2.8L',
    description: 'Fuente cerámica para mascota con bomba silenciosa y filtración por capas.',
  },
  'CloudNap Cooling Sofa Bed': {
    name: 'Cama sofá refrescante CloudNap',
    description: 'Cama tipo sofá con tela refrescante y funda lavable.',
  },
  'CloudNap Window Hammock for Cats': {
    name: 'Hamaca CloudNap para ventana, gatos',
    description: 'Hamaca soleada para ventana con ventosas reforzadas para gatos.',
  },
  'BrightBite Puzzle Treat Spinner': {
    name: 'Dispensador giratorio BrightBite tipo puzzle',
    description: 'Juguete puzzle ajustable que libera premios durante el juego supervisado.',
  },
  'BrightBite Rope & Rubber Chew Trio': {
    name: 'Trío BrightBite de cuerda y caucho para morder',
    description: 'Set de tres piezas para jalar, buscar y enriquecer la mordida.',
  },
  'PurePaws Aloe Grooming Wipes 120 Count': {
    name: 'Toallitas PurePaws con aloe, 120 piezas',
    description: 'Toallitas grandes con aloe para patas, retoques de pelaje y limpieza de viaje.',
  },
  'PurePaws Deshedding Brush Pro': {
    name: 'Cepillo deslanador PurePaws Pro',
    description: 'Cepillo cómodo para reducir pelo suelto en pelajes largos y cortos.',
  },
  'TrailTails Reflective City Leash 1.8m': {
    name: 'Correa urbana reflectante TrailTails 1.8 m',
    description: 'Correa reflectante con asa acolchada y segundo agarre para mayor control.',
  },
  'TrailTails Airline Soft Carrier': {
    name: 'Transportadora suave TrailTails para avión',
    description: 'Transportadora suave con paneles de malla, correa de hombro y tapete lavable.',
  },
  'PawPilot Pet Supplies Starter Crate': {
    name: 'Caja inicial PawPilot de artículos para mascota',
    description: 'Kit inicial amplio con platos, toallitas, juguetes y básicos de paseo.',
  },
};

const spanishProductTextPolish: Record<string, string> = {
  'Comedero automatico programable con control de porciones para gatos y perros pequenos.': 'Comedero automático programable con control de porciones para gatos y perros pequeños.',
  'Cama ortopedica CloudNap relajante': 'Cama ortopédica CloudNap relajante',
  'Cama con bordes, espuma ortopedica y funda lavable para descanso diario.': 'Cama con bordes, espuma ortopédica y funda lavable para descanso diario.',
  'Champu PurePaws de avena para piel sensible': 'Champú PurePaws de avena para piel sensible',
  'Champu suave de avena para perros y gatos con piel sensible.': 'Champú suave de avena para perros y gatos con piel sensible.',
  'Alimento NutriTail de salmon sin granos para gato, 2 kg': 'Alimento NutriTail de salmón sin granos para gato, 2 kg',
  'Alimento seco completo con salmon, taurina y minerales balanceados para gatos adultos.': 'Alimento seco completo con salmón, taurina y minerales balanceados para gatos adultos.',
  'Premios suaves de pollo en bocados pequenos para entrenar cachorros.': 'Premios suaves de pollo en bocados pequeños para entrenar cachorros.',
  'Alimento NutriTail de salmon y arroz para perro adulto, 5 kg': 'Alimento NutriTail de salmón y arroz para perro adulto, 5 kg',
  'Alimento seco balanceado de salmon y arroz para perros adultos con estomago sensible.': 'Alimento seco balanceado de salmón y arroz para perros adultos con estómago sensible.',
  'Premios cremosos HydraWhisk de atun para gato, 24 piezas': 'Premios cremosos HydraWhisk de atún para gato, 24 piezas',
  'Premios cremosos de atun para consentir, complementar comida u ocultar suplementos.': 'Premios cremosos de atún para consentir, complementar comida u ocultar suplementos.',
  'Comedero automatico compacto para gatos y perros pequenos con horarios desde la app.': 'Comedero automático compacto para gatos y perros pequeños con horarios desde la app.',
  'Estacion PawPilot de doble plato con comedero lento': 'Estación PawPilot de doble plato con comedero lento',
  'Estacion elevada con platos de acero y accesorio para comer mas lento.': 'Estación elevada con platos de acero y accesorio para comer más lento.',
  'Fuente ceramica HydraWhisk Flow 2.8L': 'Fuente cerámica HydraWhisk Flow 2.8L',
  'Fuente ceramica para mascota con bomba silenciosa y filtracion por capas.': 'Fuente cerámica para mascota con bomba silenciosa y filtración por capas.',
  'Cama sofa refrescante CloudNap': 'Cama sofá refrescante CloudNap',
  'Cama tipo sofa con tela refrescante y funda lavable.': 'Cama tipo sofá con tela refrescante y funda lavable.',
  'Trio BrightBite de cuerda y caucho para morder': 'Trío BrightBite de cuerda y caucho para morder',
  'Premios suaves para cachorro en porciones pequenas, ideales para recompensas rapidas.': 'Premios suaves para cachorro en porciones pequeñas, ideales para recompensas rápidas.',
  'Alimento para gato de interior con fibra, taurina y calorias controladas.': 'Alimento para gato de interior con fibra, taurina y calorías controladas.',
  'Cepillo comodo para reducir pelo suelto en pelajes largos y cortos.': 'Cepillo cómodo para reducir pelo suelto en pelajes largos y cortos.',
  'Transportadora suave TrailTails para avion': 'Transportadora suave TrailTails para avión',
  'Caja inicial PawPilot de articulos para mascota': 'Caja inicial PawPilot de artículos para mascota',
  'Kit inicial amplio con platos, toallitas, juguetes y basicos de paseo.': 'Kit inicial amplio con platos, toallitas, juguetes y básicos de paseo.',
};

const polishSpanishProductText = (value: string) => spanishProductTextPolish[value] || value;

const valueFromSpecs = (
  product: Product,
  language: Language,
  field: LocalizedProductField,
) => {
  const specs = product.specifications || {};
  return specs[`i18n.${language}.${field}`] || specs[`i18n.en.${field}`];
};

export const getLocalizedProductValue = (
  product: Product,
  language: Language,
  field: LocalizedProductField,
) => {
  const value = (
    valueFromSpecs(product, language, field)
    || (language === 'es' ? spanishProductFallbacks[product.name]?.[field] : undefined)
    || product[field]
    || ''
  );
  return language === 'es' ? polishSpanishProductText(value) : value;
};

export const localizeProduct = (product: Product, language: Language): Product => ({
  ...product,
  name: getLocalizedProductValue(product, language, 'name'),
  description: getLocalizedProductValue(product, language, 'description'),
  brand: getLocalizedProductValue(product, language, 'brand') || product.brand,
});
