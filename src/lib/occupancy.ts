import { StopValue } from "@/components/TripStops";

export interface TripOccupancy {
  driversCount: number;
  passengersCount: number;
  totalPeople: number;
  capacity: number;
  remaining: number;
  isExceeded: boolean;
  uniqueDriverIds: string[];
  uniquePassengerIds: string[];
}

/**
 * Calcula a ocupação da viagem considerando pessoas únicas.
 * A regra é: 1 motorista + 4 passageiros = 5 pessoas no total.
 * Mesmo que um motorista esteja em vários destinos, ele conta como 1 pessoa.
 * Se o motorista também for selecionado como passageiro, ele conta apenas 1 vez.
 */
export function calculateTripOccupancy(
  stops: StopValue[] | { driver_user_id: string | null }[],
  passengerIds: (string | null)[],
  capacity: number = 5
): TripOccupancy {
  // 1. Coletar IDs de motoristas únicos (removendo null/DAFI)
  const driverIds = new Set<string>();
  stops.forEach((s) => {
    const id = "driverUserId" in s ? s.driverUserId : s.driver_user_id;
    if (id && id !== "DAFI") {
      driverIds.add(id);
    }
  });

  // 2. Coletar IDs de passageiros únicos (removendo null)
  const pIds = new Set<string>();
  passengerIds.forEach((id) => {
    if (id) pIds.add(id);
  });

  // 3. Deduplicação: Se um passageiro também for motorista, ele conta na vaga de motorista
  // Mas fisicamente é a mesma pessoa.
  const uniqueDrivers = Array.from(driverIds);
  
  // Passageiros que NÃO são motoristas
  const uniquePassengers = Array.from(pIds).filter(id => !driverIds.has(id));

  const driversCount = uniqueDrivers.length || 1; // Se nenhum definido, reserva 1 vaga para "DAFI DEFINIR"
  const passengersCount = uniquePassengers.length;
  const totalPeople = driversCount + passengersCount;

  return {
    driversCount,
    passengersCount,
    totalPeople,
    capacity,
    remaining: Math.max(0, capacity - totalPeople),
    isExceeded: totalPeople > capacity,
    uniqueDriverIds: uniqueDrivers,
    uniquePassengerIds: uniquePassengers,
  };
}
