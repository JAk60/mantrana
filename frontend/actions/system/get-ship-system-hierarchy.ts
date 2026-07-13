'use server';

// Raw API response types
export interface Component {
  component_id: string;
  component_name: string;
  parent_id: string | null;
  parent_name: string | null;
  department_id: string;
  ship_id: string;
  CMMS_EquipmentCode: string | null;
  nomenclature: string;
  is_lmu: number;
  etl: boolean;
  created_date: string;
  modified_date: string;
}

export interface SystemData {
  system_id: string;
  system_type: string;
  created_date: string;
  component_count: number;
  components: Component[];
}

export interface ShipSystemHierarchyData {
  Total_Departments: number;
  Total_Systems: number;
  Total_Equipment: number;
  Components_With_Hierarchy: number;
  departments?: Department[];
  data: Record<string, SystemData>;
}

// Transformed types for UI
export interface Stats {
  totalDepartments: number;
  totalSystems: number;
  totalEquipment: number;
  componentsWithHierarchy: number;
}

export interface SystemUI {
  id: string;
  name: string;
  type: string;
  componentCount: number;
}

export interface ComponentUI {
  id: string;
  name: string;
  nomenclature: string;
  systemType: string;
  departmentId: string;
  isLmu: boolean;
  hasParent: boolean;
  cmmsCode: string | null;
}

export interface Department {
  department_name: string;
  department_code: string;
  ship_id: string;
  department_id: string;
  created_date: Date;
  modified_date: Date;
}

export interface TransformedHierarchyData {
  stats: Stats;
  systems: SystemUI[];
  components: ComponentUI[];
  departments: Department[];
  _data: Record<string, any>; // Raw data without transformation
}

function transformHierarchyData(data: ShipSystemHierarchyData): TransformedHierarchyData {
  // Validate data structure
  if (!data || typeof data !== 'object') {
    console.error('❌ Invalid data structure:', data);
    throw new Error('Invalid response structure from backend');
  }

  if (!data.data || typeof data.data !== 'object') {
    console.error('❌ Missing or invalid data.data:', data);
    throw new Error('Backend response missing system hierarchy data');
  }

  // Extract stats
  const stats: Stats = {
    totalDepartments: data.Total_Departments || 0,
    totalSystems: data.Total_Systems || 0,
    totalEquipment: data.Total_Equipment || 0,
    componentsWithHierarchy: data.Components_With_Hierarchy || 0,
  };

  // Transform departments
  const departments: Department[] = data.departments?.map(dept => ({
    department_id: dept.department_id,
    department_name: dept.department_name,
    department_code: dept.department_code,
    ship_id: dept.ship_id,
    created_date: new Date(dept.created_date),
    modified_date: new Date(dept.modified_date),
  })) || [];

  // Transform systems
  const systems: SystemUI[] = Object.entries(data.data).map(([name, system]) => ({
    id: system.system_id,
    name: name,
    type: system.system_type,
    componentCount: system.component_count,
  }));

  // Transform components (flatten from all systems)
  const components: ComponentUI[] = Object.entries(data.data).flatMap(([systemType, system]) =>
    system.components.map(component => ({
      id: component.component_id,
      name: component.component_name,
      nomenclature: component.nomenclature,
      systemType: systemType,
      departmentId: component.department_id,
      isLmu: component.is_lmu === 1,
      hasParent: component.parent_id !== null,
      cmmsCode: component.CMMS_EquipmentCode,
    }))
  );

  return { 
    stats, 
    systems, 
    components, 
    departments,
    _data: data // Include raw data without transformation
  };
}

/**
 * Fetches the system hierarchy for a specific ship
 * @param shipId - The UUID of the ship
 * @returns Transformed ship system hierarchy data with raw data included
 */
export async function getShipSystemHierarchy(
  shipId: string
): Promise<TransformedHierarchyData> {
  // Use environment variable with fallback
  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
  
  try {
    const url = `${BACKEND_URL}/ships/system-hierarchy-with-stat/${shipId}`;

    console.log('🔍 Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
      },
      cache: 'no-store',
    });

    console.log('📡 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Backend error response:', errorText);
      throw new Error(
        `Backend API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const hierarchyResponse = await response.json();
    console.log('📦 Raw API response:', JSON.stringify(hierarchyResponse, null, 2));
    
    // Check if response has the expected structure
    if (!hierarchyResponse || typeof hierarchyResponse !== 'object') {
      console.error('❌ Unexpected response structure:', hierarchyResponse);
      throw new Error('Backend returned unexpected response structure');
    }
    
    console.log('✅ Successfully fetched and parsed data');
    
    return transformHierarchyData(hierarchyResponse);
  } catch (error) {
    console.error('💥 Error in getShipSystemHierarchy:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch failed')) {
      throw new Error('Cannot connect to backend API at port 8000. Is your backend server running?');
    }
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Failed to fetch ship system hierarchy');
  }
}



/**
 * Fetches the children components for a specific component ID and ship ID
 * @param componentId - The UUID of the parent component
 * @param shipId - The UUID of the ship
 * @returns Complete hierarchy with nested children
 */
export async function getComponentChildren(
  componentId: string,
  shipId: string
): Promise<any> {
  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
  
  try {
    // Encode URL parameters
    const params = new URLSearchParams({
      component_id: componentId,
      ship_id: shipId,
    });
    
    const url = `${BACKEND_URL}/components/hierarchy_with_ids?${params.toString()}`;

    console.log('🔍 Fetching component hierarchy from:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
      },
      cache: 'no-store',
    });

    console.log('📡 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Backend error response:', errorText);
      throw new Error(
        `Backend API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const hierarchy = await response.json();
    console.log('📦 Component hierarchy response:', JSON.stringify(hierarchy, null, 2));
    
    console.log(`✅ Successfully fetched hierarchy for component ${componentId}`);
    
    return hierarchy;
  } catch (error) {
    console.error('💥 Error in getComponentChildren:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch failed')) {
      throw new Error('Cannot connect to backend API at port 8000. Is your backend server running?');
    }
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Failed to fetch component hierarchy');
  }
}