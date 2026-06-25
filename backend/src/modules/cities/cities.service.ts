import { prisma } from '@/config/database.js'

export interface CityResponse {
  id: string
  name: string
  province: string | null
  region: string | null
  country: string
  isActive: boolean
  zonesCount: number
}

export async function getCities(): Promise<CityResponse[]> {
  const cities = await prisma.city.findMany({
    where: { isActive: true },
    include: { _count: { select: { zones: true } } },
    orderBy: { name: 'asc' },
  })

  return cities.map((city) => ({
    id: city.id,
    name: city.name,
    province: city.province,
    region: city.region,
    country: city.country,
    isActive: city.isActive,
    zonesCount: city._count.zones,
  }))
}

export async function getCityById(id: string): Promise<CityResponse | null> {
  const city = await prisma.city.findUnique({
    where: { id },
    include: { _count: { select: { zones: true } } },
  })

  if (!city) return null

  return {
    id: city.id,
    name: city.name,
    province: city.province,
    region: city.region,
    country: city.country,
    isActive: city.isActive,
    zonesCount: city._count.zones,
  }
}
