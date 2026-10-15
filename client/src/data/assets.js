// Reference catalog transcribed from the supplied assessment asset_reference.csv
// and line_reference.csv. The backend API remains the source of truth for state.
export const PLANTS = [
  { id: 'PLANT_01', label: 'Plant 01' },
  { id: 'PLANT_02', label: 'Plant 02' },
];

export const LINES = [
  { id: 'LINE-A', plantId: 'PLANT_01', name: 'Assembly' },
  { id: 'LINE-B', plantId: 'PLANT_01', name: 'Finishing' },
  { id: 'LINE-C', plantId: 'PLANT_01', name: 'Utilities' },
  { id: 'LINE-D', plantId: 'PLANT_02', name: 'Mixing' },
  { id: 'LINE-E', plantId: 'PLANT_02', name: 'Packaging' },
];

export const MACHINES = [
  { id: 'EQ-001', plantId: 'PLANT_01', lineId: 'LINE-A', type: 'Press', criticality: 'high' },
  { id: 'EQ-002', plantId: 'PLANT_01', lineId: 'LINE-A', type: 'Conveyor', criticality: 'medium' },
  { id: 'EQ-003', plantId: 'PLANT_01', lineId: 'LINE-B', type: 'Cutter', criticality: 'high' },
  { id: 'EQ-004', plantId: 'PLANT_01', lineId: 'LINE-C', type: 'Compressor', criticality: 'high' },
  { id: 'EQ-005', plantId: 'PLANT_02', lineId: 'LINE-D', type: 'Mixer', criticality: 'medium' },
  { id: 'EQ-006', plantId: 'PLANT_02', lineId: 'LINE-D', type: 'Packager', criticality: 'low' },
  { id: 'EQ-007', plantId: 'PLANT_02', lineId: 'LINE-E', type: 'Pump', criticality: 'high' },
  { id: 'EQ-008', plantId: 'PLANT_02', lineId: 'LINE-E', type: 'Dryer', criticality: 'medium' },
];
