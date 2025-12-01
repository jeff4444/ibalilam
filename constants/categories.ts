import { Smartphone, Wrench, Package, Laptop, Gamepad2, Cpu, LucideIcon } from "lucide-react"

export interface CategoryField {
  required: boolean
  label: string
}

export interface CategoryConfig {
  name: string
  icon: LucideIcon
  subcategories: string[]
  fields: Record<string, CategoryField>
}

export const CATEGORY_HIERARCHY: Record<string, CategoryConfig> = {
  mobile_phones: {
    name: "Mobile Phones",
    icon: Smartphone,
    subcategories: ["smartphones", "feature phones"],
    fields: {
      brand: { required: true, label: "Brand" },
      model: { required: true, label: "Model" },
      storage_capacity: { required: true, label: "Storage Capacity" },
      imei: { required: true, label: "IMEI Number" },
      network_status: { required: true, label: "Network Status" },
      has_box: { required: false, label: "Includes Original Box" },
      has_charger: { required: false, label: "Includes Charger" }
    }
  },
  phone_parts: {
    name: "Phone Parts",
    icon: Wrench,
    subcategories: ["screen", "battery", "charging port", "camera", "speaker", "microphone", "housing", "other"],
    fields: {
      part_type_detail: { required: true, label: "Part Type" },
      brand: { required: true, label: "Brand" },
      model_compatibility: { required: true, label: "Model Compatibility (e.g., Samsung A30)" },
      moq: { required: false, label: "Minimum Order Quantity" }
    }
  },
  phone_accessories: {
    name: "Phone Accessories",
    icon: Package,
    subcategories: ["charger", "case", "earphones", "screen protector", "cable", "other"],
    fields: {
      accessory_type: { required: true, label: "Accessory Type" },
      brand: { required: false, label: "Brand" }
    }
  },
  laptops: {
    name: "Laptops",
    icon: Laptop,
    subcategories: ["gaming", "business", "ultrabook", "workstation", "chromebook", "other"],
    fields: {
      brand: { required: true, label: "Brand" },
      model: { required: true, label: "Model" },
      cpu: { required: true, label: "CPU" },
      ram: { required: true, label: "RAM" },
      storage: { required: true, label: "Storage" },
      screen_size: { required: true, label: "Screen Size" },
      battery_health: { required: false, label: "Battery Health (%)" }
    }
  },
  steam_kits: {
    name: "STEAM Kits",
    icon: Gamepad2,
    subcategories: ["coding", "robotics", "ai", "electronics", "other"],
    fields: {
      kit_type: { required: true, label: "Kit Type" },
      brand: { required: true, label: "Brand" },
      age_group: { required: false, label: "Age Group" }
    }
  },
  other_electronics: {
    name: "Other Electronics",
    icon: Cpu,
    subcategories: ["tv", "audio", "gaming", "networking", "power", "other"],
    fields: {
      electronics_subcategory: { required: true, label: "Subcategory" },
      key_specs: { required: false, label: "Key Specifications" }
    }
  }
}

// Helper function to get category config by key
export function getCategoryConfig(categoryKey: string): CategoryConfig | undefined {
  return CATEGORY_HIERARCHY[categoryKey]
}

// Helper function to get all category keys
export function getCategoryKeys(): string[] {
  return Object.keys(CATEGORY_HIERARCHY)
}

// Default icon for categories not in the hierarchy
export const DEFAULT_CATEGORY_ICON = Package

