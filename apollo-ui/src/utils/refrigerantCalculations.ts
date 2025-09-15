// Refrigerant pressure-temperature calculations
// PT charts for common refrigerants at saturation

interface PTData {
  [key: string]: {
    [pressure: number]: number; // pressure (PSI) -> temperature (°F)
  };
}

// Simplified PT data for common refrigerants
// In production, this would be more comprehensive
const refrigerantPTData: PTData = {
  'R-410A': {
    50: -10, 60: -2, 70: 5, 80: 11, 90: 16, 100: 21, 110: 25, 120: 29,
    130: 33, 140: 36, 150: 39, 160: 42, 170: 45, 180: 47, 190: 50,
    200: 52, 210: 54, 220: 56, 230: 58, 240: 60, 250: 62, 260: 64,
    270: 66, 280: 68, 290: 69, 300: 71, 320: 74, 340: 77, 360: 80,
    380: 83, 400: 85, 420: 88, 440: 90, 460: 93, 480: 95, 500: 97
  },
  'R-22': {
    40: -2, 50: 6, 60: 14, 70: 21, 80: 27, 90: 32, 100: 37, 110: 41,
    120: 45, 130: 49, 140: 52, 150: 55, 160: 58, 170: 61, 180: 64,
    190: 66, 200: 69, 210: 71, 220: 73, 230: 75, 240: 77, 250: 79,
    260: 81, 270: 83, 280: 85, 290: 87, 300: 88, 320: 92, 340: 95
  },
  'R-404A': {
    40: -20, 50: -13, 60: -7, 70: -2, 80: 3, 90: 7, 100: 11, 110: 15,
    120: 18, 130: 21, 140: 24, 150: 27, 160: 30, 170: 32, 180: 35,
    190: 37, 200: 39, 210: 41, 220: 43, 230: 45, 240: 47, 250: 49,
    260: 51, 270: 52, 280: 54, 290: 56, 300: 57, 320: 60, 340: 63
  },
  'R-134a': {
    10: -15, 15: -5, 20: 2, 25: 9, 30: 15, 35: 20, 40: 25, 45: 29,
    50: 33, 55: 37, 60: 40, 65: 43, 70: 46, 75: 49, 80: 52, 85: 54,
    90: 57, 95: 59, 100: 62, 110: 66, 120: 70, 130: 74, 140: 77,
    150: 81, 160: 84, 170: 87, 180: 90, 190: 92, 200: 95, 220: 100
  },
  'R-407C': {
    40: -8, 50: 0, 60: 7, 70: 14, 80: 20, 90: 25, 100: 30, 110: 34,
    120: 38, 130: 42, 140: 45, 150: 48, 160: 51, 170: 54, 180: 57,
    190: 59, 200: 62, 210: 64, 220: 66, 230: 68, 240: 70, 250: 72,
    260: 74, 270: 76, 280: 78, 290: 80, 300: 82, 320: 85, 340: 88
  }
};

// Get saturation temperature for a given pressure and refrigerant
export function getSaturationTemp(pressure: number, refrigerant: string): number {
  const ptData = refrigerantPTData[refrigerant];
  if (!ptData) {
    console.warn(`No PT data for refrigerant: ${refrigerant}`);
    return 0;
  }

  // Find the two closest pressure points and interpolate
  const pressures = Object.keys(ptData).map(Number).sort((a, b) => a - b);

  // If pressure is out of range, use closest value
  if (pressure <= pressures[0]) return ptData[pressures[0]];
  if (pressure >= pressures[pressures.length - 1]) return ptData[pressures[pressures.length - 1]];

  // Find surrounding pressures for interpolation
  let lowerP = pressures[0];
  let upperP = pressures[1];

  for (let i = 0; i < pressures.length - 1; i++) {
    if (pressure >= pressures[i] && pressure <= pressures[i + 1]) {
      lowerP = pressures[i];
      upperP = pressures[i + 1];
      break;
    }
  }

  // Linear interpolation
  const lowerT = ptData[lowerP];
  const upperT = ptData[upperP];
  const ratio = (pressure - lowerP) / (upperP - lowerP);

  return lowerT + (upperT - lowerT) * ratio;
}

// Calculate superheat (actual suction temp - saturation temp at suction pressure)
export function calculateSuperheat(
  suctionTemp: number,
  suctionPressure: number,
  refrigerant: string
): number {
  const satTemp = getSaturationTemp(suctionPressure, refrigerant);
  return suctionTemp - satTemp;
}

// Calculate subcooling (saturation temp at discharge pressure - actual liquid temp)
export function calculateSubcooling(
  liquidTemp: number,
  dischargePressure: number,
  refrigerant: string
): number {
  const satTemp = getSaturationTemp(dischargePressure, refrigerant);
  return satTemp - liquidTemp;
}

// Calculate system temperatures based on refrigerant and pressures
export function calculateSystemTemps(
  highPressure: number,
  lowPressure: number,
  suctionLineTemp: number,
  liquidLineTemp: number,
  refrigerant: string
) {
  // Get saturation temperatures
  const evaporatorSatTemp = getSaturationTemp(lowPressure, refrigerant);
  const condenserSatTemp = getSaturationTemp(highPressure, refrigerant);

  // Calculate superheat and subcooling
  const superheat = suctionLineTemp - evaporatorSatTemp;
  const subcooling = condenserSatTemp - liquidLineTemp;

  return {
    superheat: Math.round(superheat),
    suctionLineTemp: Math.round(suctionLineTemp),
    subcooling: Math.round(subcooling),
    liquidLineTemp: Math.round(liquidLineTemp),
    evaporatorSatTemp: Math.round(evaporatorSatTemp),
    condenserSatTemp: Math.round(condenserSatTemp)
  };
}

// Get refrigerant type from equipment or use default
export function getRefrigerantType(equipment: any): string {
  if (!equipment) return 'R-410A';

  // Check for refrigerant_type field
  if (equipment.refrigerant_type) {
    return equipment.refrigerant_type;
  }

  // Default based on equipment type
  switch (equipment.equipment_type?.toLowerCase()) {
    case 'chiller':
      return 'R-134a';
    case 'refrigeration':
    case 'freezer':
      return 'R-404A';
    case 'heat pump':
    case 'ac':
    case 'air conditioner':
    default:
      return 'R-410A';
  }
}