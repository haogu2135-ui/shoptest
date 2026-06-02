import type { ProductPublic } from '../types';
import type { Language } from '../i18n';

type LocalizedProductField = 'name' | 'description' | 'brand';

const spanishProductFallbacks: Record<string, Partial<Record<LocalizedProductField, string>>> = {
  'PawPilot Smart Pet Feeder 4L': {
    name: 'Comedero inteligente PawPilot 4L',
    description: 'Comedero automático programable con control de porciones para gatos y perros pequeños.',
  },
  'HydraWhisk Quiet Cat Water Fountain': {
    name: 'Fuente silenciosa HydraWhisk para gato',
    description: 'Fuente filtrada de bajo ruido que ayuda a los gatos a beber más agua.',
  },
  'TrailTails Walking Starter Bundle': {
    name: 'Kit TrailTails de paseo inicial',
    description: 'Correa, collar y bolsas en un kit para paseos diarios más seguros.',
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
    description: 'Premios suaves para cachorro en porciones pequeñas, ideales para recompensas rápidas.',
  },
  'NutriTail Indoor Cat Hairball Control 3kg': {
    name: 'Alimento NutriTail para gato indoor control bolas de pelo, 3 kg',
    description: 'Alimento para gato de interior con fibra, taurina y calorías controladas.',
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

const chineseProductFallbacks: Record<string, Partial<Record<LocalizedProductField, string>>> = {
  'PawPilot Smart Pet Feeder 4L': {
    name: 'PawPilot 4L 智能宠物喂食器',
    description: '可编程自动喂食器，支持猫咪和小型犬分餐定量。',
  },
  'HydraWhisk Quiet Cat Water Fountain': {
    name: 'HydraWhisk 静音猫咪饮水机',
    description: '低噪过滤饮水机，帮助猫咪多喝水。',
  },
  'TrailTails Walking Starter Bundle': {
    name: 'TrailTails 入门遛宠套装',
    description: '牵引绳、项圈和拾便袋收纳组合，让日常出行更安心。',
  },
  'CloudNap Orthopedic Calming Bed': {
    name: 'CloudNap 舒缓骨科宠物床',
    description: '带围边宠物床，配骨科支撑海绵和可洗床套。',
  },
  'BrightBite Dental Chew Toy Set': {
    name: 'BrightBite 洁齿咬咬玩具套装',
    description: '两件耐咬玩具，带纹理设计，兼顾玩耍和日常洁齿。',
  },
  'PurePaws Oatmeal Sensitive Shampoo': {
    name: 'PurePaws 敏感肌燕麦宠物香波',
    description: '温和燕麦香波，适合敏感皮肤的犬猫。',
  },
  'NutriTail Grain-Free Salmon Cat Food 2kg': {
    name: 'NutriTail 无谷三文鱼猫粮 2 kg',
    description: '含三文鱼、牛磺酸和均衡矿物质的成猫全价干粮。',
  },
  'CanineCore Puppy Training Treats': {
    name: 'CanineCore 幼犬训练奖励零食',
    description: '柔软鸡肉小颗粒，适合幼犬训练奖励。',
  },
  'NutriTail Adult Dog Salmon & Rice 5kg': {
    name: 'NutriTail 三文鱼米饭成犬粮 5 kg',
    description: '三文鱼和米饭配方干粮，适合肠胃敏感成犬。',
  },
  'CanineCore Puppy Chicken Bites 500g': {
    name: 'CanineCore 幼犬鸡肉小粒 500 g',
    description: '小份柔软幼犬奖励零食，适合快速训练奖励。',
  },
  'NutriTail Indoor Cat Hairball Control 3kg': {
    name: 'NutriTail 室内猫化毛控制猫粮 3 kg',
    description: '含纤维、牛磺酸和控卡配方，适合室内猫。',
  },
  'HydraWhisk Tuna Creamy Cat Treats 24 Pack': {
    name: 'HydraWhisk 金枪鱼猫条 24 支',
    description: '金枪鱼风味顺滑猫条，可作奖励、拌粮或藏药。',
  },
  'PawPilot Smart Feeder Mini 2L': {
    name: 'PawPilot Mini 2L 智能喂食器',
    description: '紧凑型自动喂食器，适合猫咪和小型犬，可通过 App 设定喂食时间。',
  },
  'PawPilot Dual Bowl Slow Feeder Station': {
    name: 'PawPilot 双碗慢食喂食站',
    description: '抬高式双不锈钢碗，配慢食配件，帮助放慢进食速度。',
  },
  'HydraWhisk Ceramic Flow Fountain 2.8L': {
    name: 'HydraWhisk Flow 2.8L 陶瓷饮水机',
    description: '陶瓷宠物饮水机，静音水泵和多层过滤。',
  },
  'CloudNap Cooling Sofa Bed': {
    name: 'CloudNap 清凉沙发宠物床',
    description: '沙发式清凉面料宠物床，床套可拆洗。',
  },
  'CloudNap Window Hammock for Cats': {
    name: 'CloudNap 猫咪窗边吊床',
    description: '带加固吸盘的窗边日光吊床，适合猫咪休息。',
  },
  'BrightBite Puzzle Treat Spinner': {
    name: 'BrightBite 旋转漏食益智玩具',
    description: '可调节漏食益智玩具，适合看护下互动玩耍。',
  },
  'BrightBite Rope & Rubber Chew Trio': {
    name: 'BrightBite 绳结橡胶咬咬三件套',
    description: '三件套适合拉扯、寻回和丰富咬咬体验。',
  },
  'PurePaws Aloe Grooming Wipes 120 Count': {
    name: 'PurePaws 芦荟清洁湿巾 120 片',
    description: '大尺寸芦荟湿巾，适合爪子、毛发局部清洁和出行擦拭。',
  },
  'PurePaws Deshedding Brush Pro': {
    name: 'PurePaws Pro 去浮毛梳',
    description: '舒适去浮毛梳，适合长短毛日常护理。',
  },
  'TrailTails Reflective City Leash 1.8m': {
    name: 'TrailTails 城市反光牵引绳 1.8 m',
    description: '反光牵引绳，配软垫手柄和第二控制握把。',
  },
  'TrailTails Airline Soft Carrier': {
    name: 'TrailTails 航空软质宠物包',
    description: '软质宠物包，带网眼透气面板、肩带和可清洗垫子。',
  },
  'PawPilot Pet Supplies Starter Crate': {
    name: 'PawPilot 宠物用品入门箱',
    description: '大容量入门套装，含碗、湿巾、玩具和基础遛宠用品。',
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
  'Fuente filtrada de bajo ruido que ayuda a los gatos a beber mas agua.': 'Fuente filtrada de bajo ruido que ayuda a los gatos a beber más agua.',
  'Correa, collar y bolsas en un kit para paseos diarios mas seguros.': 'Correa, collar y bolsas en un kit para paseos diarios más seguros.',
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
  product: ProductPublic,
  language: Language,
  field: LocalizedProductField,
) => {
  const localized = product.localizedContent && typeof product.localizedContent === 'object'
    ? (product.localizedContent as Record<string, Record<string, string> | undefined>)
    : null;
  const localizedValue = localized?.[language]?.[field] || localized?.en?.[field];
  if (localizedValue) return localizedValue;
  const specs = product.specifications || {};
  return specs[`i18n.${language}.${field}`] || specs[`i18n.en.${field}`];
};

export const getLocalizedProductValue = (
  product: ProductPublic,
  language: Language,
  field: LocalizedProductField,
) => {
  const value = (
    valueFromSpecs(product, language, field)
    || (language === 'es' ? spanishProductFallbacks[product.name]?.[field] : undefined)
    || (language === 'zh' ? chineseProductFallbacks[product.name]?.[field] : undefined)
    || product[field]
    || ''
  );
  return language === 'es' ? polishSpanishProductText(value) : value;
};

export const localizeProduct = <T extends ProductPublic>(product: T, language: Language): T => ({
  ...product,
  name: getLocalizedProductValue(product, language, 'name'),
  description: getLocalizedProductValue(product, language, 'description'),
  brand: getLocalizedProductValue(product, language, 'brand') || product.brand,
});
