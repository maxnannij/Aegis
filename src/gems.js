/**
 * Aegis - Gem definitions
 * Based exactly on GemCraft Labyrinth gem types.
 *
 * Each gem has:
 * - id, name, color (hex + CSS name)
 * - special effect description and base parameters
 * - base stats that scale with grade
 *
 * Grades: 1 to 12+ (higher via fusion)
 * Fusion rules (same as original):
 * - Same type + same grade → higher grade pure gem (strong special)
 * - Different types → dual/triple gem (damage/range/speed bonus, weaker specials)
 * - Prefer pure for strong specials, dual/triple for raw power.
 */

export const GEM_TYPES = {
  yellow: {
    id: 'yellow',
    name: 'Multiple Damage',
    nameEs: 'Daño Múltiple',
    color: '#F4D03F',
    colorName: 'Amarillo',
    special: 'multipleDamage',
    description: 'Cada disparo tiene chance de infligir daño multiplicado.',
    descriptionEn: 'Each shot has a chance to inflict multiplied damage.',
    // Base values at grade 1 (will scale)
    baseDamage: [8, 12],
    baseRange: 90,
    baseFireRate: 1.0, // shots per second
    specialParams: {
      chance: 0.15,      // 15% chance
      multiplier: 3      // x3 damage
    }
  },

  orange: {
    id: 'orange',
    name: 'Mana Gathering',
    nameEs: 'Recolección de Mana',
    color: '#E67E22',
    colorName: 'Naranja',
    special: 'manaGathering',
    description: 'Extrae mana del objetivo al impactar.',
    descriptionEn: 'Extract mana from target on hit.',
    baseDamage: [6, 10],
    baseRange: 85,
    baseFireRate: 1.1,
    specialParams: {
      manaPerHit: 1.5    // mana stolen per hit (scales with grade)
    }
  },

  red: {
    id: 'red',
    name: 'Bloodbound',
    nameEs: 'Vinculado a la Sangre',
    color: '#E74C3C',
    colorName: 'Rojo',
    special: 'bloodbound',
    description: 'Un porcentaje del total de kills se suma al daño.',
    descriptionEn: 'A percentage of total kills goes to damage.',
    baseDamage: [7, 11],
    baseRange: 88,
    baseFireRate: 1.0,
    specialParams: {
      damagePerKill: 0.4  // +0.4 damage per kill by this gem (very sensitive to mixing)
    }
  },

  purple: {
    id: 'purple',
    name: 'Armor Tearing',
    nameEs: 'Desgarro de Armadura',
    color: '#9B59B6',
    colorName: 'Púrpura',
    special: 'armorTearing',
    description: 'Degrada el nivel de armadura del objetivo en cada hit.',
    descriptionEn: 'Degrades the target\'s armor level on each hit.',
    baseDamage: [5, 9],
    baseRange: 92,
    baseFireRate: 0.95,
    specialParams: {
      armorReduction: 1   // reduces armor by 1 per hit (scales)
    }
  },

  green: {
    id: 'green',
    name: 'Poisonous',
    nameEs: 'Venenoso',
    color: '#27AE60',
    colorName: 'Verde',
    special: 'poisonous',
    description: 'Daño adicional por tiempo que ignora armadura y escudo.',
    descriptionEn: 'Deals additional damage over time that ignores armor and shield.',
    baseDamage: [4, 8],
    baseRange: 80,
    baseFireRate: 1.0,
    specialParams: {
      poisonDps: 3,       // damage per second
      duration: 4         // seconds
    }
  },

  blue: {
    id: 'blue',
    name: 'Slowing',
    nameEs: 'Ralentización',
    color: '#3498DB',
    colorName: 'Azul',
    special: 'slowing',
    description: 'Cada hit ralentiza al objetivo por un corto tiempo.',
    descriptionEn: 'Each hit slows its target for a short time.',
    baseDamage: [5, 9],
    baseRange: 95,
    baseFireRate: 1.05,
    specialParams: {
      slowFactor: 0.5,   // 50% speed
      duration: 1.5       // seconds
    }
  },

  cyan: {
    id: 'cyan',
    name: 'Shocking',
    nameEs: 'Electrocución',
    color: '#1ABC9C',
    colorName: 'Cian',
    special: 'shocking',
    description: 'Chance de paralizar al objetivo (no puede moverse).',
    descriptionEn: 'Chance to shock the target, making it unable to move for a short time.',
    baseDamage: [6, 10],
    baseRange: 85,
    baseFireRate: 0.9,
    specialParams: {
      chance: 0.12,
      duration: 1.2
    }
  },

  lime: {
    id: 'lime',
    name: 'Chain Hit',
    nameEs: 'Golpe en Cadena',
    color: '#A8E6CF',
    colorName: 'Lima',
    special: 'chainHit',
    description: 'Chance de golpear a múltiples enemigos cercanos.',
    descriptionEn: 'Chance to hit multiple enemies.',
    baseDamage: [7, 11],
    baseRange: 100,
    baseFireRate: 0.95,
    specialParams: {
      chance: 0.20,
      maxTargets: 3,
      chainRange: 60
    }
  }
};

/** Grade shapes (visual reference for later sprites) */
export const GRADE_SHAPES = {
  1: 'triangle-curved',
  2: 'triangle-concave',
  3: 'square',
  4: 'square-concave-top',
  5: 'square-all-concave',
  6: 'diamond',
  7: 'kite',
  8: 'pentagon',
  9: 'star-5',
  10: 'hexagon',
  11: 'crescent',
  12: 'circle' // 12+
};

/**
 * Create a pure gem of given type and grade
 */
export function createGem(typeId, grade = 1) {
  const type = GEM_TYPES[typeId];
  if (!type) throw new Error(`Unknown gem type: ${typeId}`);

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `gem-${Date.now()}-${Math.random()}`,
    typeId,
    grade,
    types: [typeId],          // for mixed gems: array of base types
    isPure: true,
    kills: 0,                 // for bloodbound
    // Computed stats will be calculated by getGemStats()
  };
}

/**
 * Basic fusion: two gems → one higher grade or mixed
 * Same rules as GemCraft Labyrinth (simplified for now)
 */
export function fuseGems(gemA, gemB) {
  const newGrade = Math.max(gemA.grade, gemB.grade) + 1;
  const typesA = new Set(gemA.types || [gemA.typeId]);
  const typesB = new Set(gemB.types || [gemB.typeId]);
  const combinedTypes = [...new Set([...typesA, ...typesB])];

  // Limit to 3 specials max (original rule)
  const finalTypes = combinedTypes.slice(0, 3);

  const isPure = finalTypes.length === 1;

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `gem-${Date.now()}-${Math.random()}`,
    typeId: isPure ? finalTypes[0] : 'mixed',
    grade: newGrade,
    types: finalTypes,
    isPure,
    kills: (gemA.kills || 0) + (gemB.kills || 0), // bloodbound carries over somehow
    // Dual/triple get damage/range/speed bonuses in original
  };
}

/**
 * Placeholder stats calculator (will refine with exact formulas later)
 */
export function getGemStats(gem) {
  const type = gem.isPure ? GEM_TYPES[gem.typeId] : null;
  const grade = gem.grade;

  // Rough scaling: each grade ~ +40-60% power
  const gradeMult = Math.pow(1.45, grade - 1);

  let baseDmgMin = 6, baseDmgMax = 10, baseRange = 90, baseRate = 1.0;
  let specials = [];

  if (gem.isPure && type) {
    baseDmgMin = type.baseDamage[0];
    baseDmgMax = type.baseDamage[1];
    baseRange = type.baseRange;
    baseRate = type.baseFireRate;
    specials = [{ type: type.special, params: { ...type.specialParams } }];
  } else {
    // Mixed: average bases + dual/triple bonuses (original gives bonuses)
    const dualBonus = gem.types.length === 2 ? 1.15 : gem.types.length >= 3 ? 1.25 : 1;
    baseDmgMin = 7 * dualBonus;
    baseDmgMax = 11 * dualBonus;
    baseRange = 92 * dualBonus;
    baseRate = 1.05 * dualBonus;

    // Weaker specials
    gem.types.forEach(tid => {
      const t = GEM_TYPES[tid];
      if (t) {
        specials.push({
          type: t.special,
          params: scaleSpecialParams(t.specialParams, 0.6) // reduced power
        });
      }
    });
  }

  // Bloodbound extra
  let extraDamage = 0;
  if (gem.types.includes('red') || gem.typeId === 'red') {
    const blood = GEM_TYPES.red.specialParams.damagePerKill;
    extraDamage = (gem.kills || 0) * blood * (gem.isPure ? 1 : 0.4); // pure is much stronger
  }

  return {
    damageMin: Math.round(baseDmgMin * gradeMult + extraDamage),
    damageMax: Math.round(baseDmgMax * gradeMult + extraDamage),
    range: Math.round(baseRange * (1 + (grade - 1) * 0.08)),
    fireRate: +(baseRate * (1 + (grade - 1) * 0.05)).toFixed(2),
    specials,
    grade,
    isPure: gem.isPure,
    types: gem.types
  };
}

function scaleSpecialParams(params, factor) {
  const scaled = {};
  for (const [k, v] of Object.entries(params)) {
    scaled[k] = typeof v === 'number' ? +(v * factor).toFixed(3) : v;
  }
  return scaled;
}

export const GEM_TYPE_LIST = Object.keys(GEM_TYPES);
