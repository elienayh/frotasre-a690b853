import { StopValue } from "@/components/TripStops";

/** Capacidade padrão de um veículo da frota (1 motorista + 4 passageiros). */
export const DEFAULT_CAPACITY = 5;

/** Linha mínima de ocupante necessária para o cálculo de vagas. */
export interface OccupantLike {
  user_id?: string | null;
  is_external?: boolean | null;
  is_driver?: boolean | null;
  status?: string | null;
}

/** Trecho mínimo necessário para identificar condutores do itinerário. */
export interface StopLike {
  driver_user_id?: string | null;
}

export interface SeatInfo {
  capacity: number;
  occupied: number;
  available: number;
  /** Texto pronto no singular/plural: "1 vaga" / "3 vagas". */
  label: string;
}

/**
 * Fonte única de cálculo de vagas.
 *
 * Regra: toda viagem reserva 1 vaga de motorista (mesmo quando ainda "a definir
 * pela DAFI") + os passageiros extras confirmados. Motoristas nunca são
 * recontados como passageiros.
 */
export function calculateSeats(
  occupants: OccupantLike[] | null | undefined,
  stops: StopLike[] | null | undefined,
  capacity?: number | null,
): SeatInfo {
  const cap = capacity && capacity > 0 ? capacity : DEFAULT_CAPACITY;

  // 1. Motoristas identificados (trechos + ocupantes marcados como motorista).
  const drivers = new Set<string>();
  (stops ?? []).forEach((s) => {
    const id = s.driver_user_id;
    if (id && id !== "DAFI") drivers.add(id);
  });
  (occupants ?? []).forEach((o) => {
    if ((o.status ?? "").toUpperCase() === "RECUSADO") return;
    if (o.is_driver && o.user_id) drivers.add(o.user_id);
  });

  // 2. Passageiros extras únicos (excluindo quem já ocupa vaga de motorista).
  const passengers = new Set<string>();
  let anonymous = 0;
  (occupants ?? []).forEach((o) => {
    if ((o.status ?? "").toUpperCase() === "RECUSADO") return;
    if (o.is_driver) return;
    if (o.user_id) {
      if (!drivers.has(o.user_id)) passengers.add(o.user_id);
      return;
    }
    // Ocupantes externos (sem conta) contam como pessoas distintas.
    anonymous += 1;
  });

  // 3. Sempre há ao menos 1 vaga de motorista reservada.
  const driverSeats = Math.max(1, drivers.size);
  const occupied = Math.min(cap, driverSeats + passengers.size + anonymous);
  const available = Math.max(0, cap - occupied);

  return {
    capacity: cap,
    occupied,
    available,
    label: `${available} ${available === 1 ? "vaga" : "vagas"}`,
  };
}


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
  // Motoristas nunca são recontados como passageiros (pessoas únicas).
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
