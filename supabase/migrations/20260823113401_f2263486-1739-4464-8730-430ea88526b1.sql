ALTER TABLE public.trip_requests DROP CONSTRAINT IF EXISTS trip_requests_passengers_check;
ALTER TABLE public.trip_requests ADD CONSTRAINT trip_requests_passengers_check CHECK (passengers >= 0);